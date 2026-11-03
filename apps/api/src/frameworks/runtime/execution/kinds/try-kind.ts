import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import {
  type AttemptPolicy,
  type CompositeKind,
  EndingKind,
  type Fault,
  type ListEnding,
  type ListRetry,
  type Runner,
  type TaskEnding,
  type TaskItem,
} from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { TaskFault } from '../faults.js';
import { Journal } from '../journal.js';
import type { Scope } from '../scope.js';
import type { TaskKindRegistry } from '../task-kind-registry.js';
import { CatchClause } from './catch-clause.js';
import { RetryPolicy } from './retry-policy.js';

enum Verdict {
  Uncaught = 'uncaught',
  Handled = 'handled',
  Spent = 'spent',
}

// `try`: its tasks, and on a fault the `catch` decides. A caught error is retried while the
// policy allows: a single task by the engine itself (the step's attempts and durable delays),
// several tasks by running the list again after a durable sleep. Either way the retry is decided
// where the fault arose, so the faulted task's record says when the next attempt begins. Then
// `catch.do` runs, or the task completes with its input when nothing was to be retried, or
// faults when the retries are spent.
export class TryKind implements CompositeKind {
  constructor(
    private readonly evaluator: Evaluator,
    private readonly kinds: TaskKindRegistry,
  ) {}

  run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const attempted = task as Specification.TryTask;
    const clause = new CatchClause(attempted.catch ?? {});
    const declared = (scope.run.workflow.use?.retries ?? {}) as JsonObject;
    const policy = RetryPolicy.of(attempted.catch?.retry, declared);
    const body = attempted.try ?? [];
    const single = TryKind.#single(body, this.kinds);

    if (single !== null && policy !== null)
      return this.#retriedByEngine(
        single,
        clause,
        policy,
        input,
        args,
        scope,
        runner,
      );

    return this.#retriedInLoop(
      body,
      clause,
      policy,
      input,
      args,
      scope,
      runner,
    );
  }

  async #retriedByEngine(
    item: TaskItem,
    clause: CatchClause,
    policy: RetryPolicy,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const firstAt = scope.startedAt;
    const durability = scope.run.durability;
    const attempts: AttemptPolicy = {
      retry: { attempts: policy.attempts },
      catches: (error) =>
        clause.catches(error, input, args, scope, this.evaluator),
      delayAfter: (attempt) => policy.delayAfter(attempt),
      retries: async (error, attempt) => {
        const caught = await clause.catches(
          error,
          input,
          args,
          scope,
          this.evaluator,
        );
        const elapsed = durability.stepTime() - firstAt;
        const allowed = caught && policy.allows(attempt, elapsed);

        if (!allowed) return false;

        return clause.retries(
          policy,
          error,
          input,
          args,
          scope,
          this.evaluator,
        );
      },
    };
    const placed = scope.child('try').child(0).child(item.name);
    const ending = await runner.task(item, input, placed, attempts);

    if (ending.kind !== EndingKind.Faulted) return TryKind.#listed(ending);

    const verdict = await Journal.value(scope, 'catch', async () => {
      const caught = await clause.catches(
        ending.error,
        input,
        args,
        scope,
        this.evaluator,
      );
      return caught ? Verdict.Spent : Verdict.Uncaught;
    });

    if (!verdict.ok)
      return {
        kind: EndingKind.Faulted,
        error: verdict.error,
        retryAt: verdict.retryAt,
      };

    if (verdict.value === Verdict.Uncaught) return ending;

    return this.#handled(clause, ending.error, input, scope, runner, true);
  }

  async #retriedInLoop(
    body: Specification.TaskList,
    clause: CatchClause,
    policy: RetryPolicy | null,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const durability = scope.run.durability;
    const firstAt = scope.startedAt;

    for (let attempt = 1; ; attempt += 1) {
      const attemptScope = scope.attempted(attempt);
      // Where the fault arose, a condition this try cannot evaluate retries nothing; the try's
      // own decision then evaluates it again and faults with its error.
      const retry: ListRetry = {
        retryAt: async (error) => {
          try {
            return await this.#retryAt(
              clause,
              policy,
              error,
              attempt,
              firstAt,
              input,
              args,
              scope,
            );
          } catch (thrown) {
            if (!(thrown instanceof TaskFault)) throw thrown;

            return null;
          }
        },
      };
      const bodyScope = attemptScope.child('try').retrying(retry);
      const ending = await runner.list(body, input, bodyScope);

      if (ending.kind !== EndingKind.Faulted) return ending;

      const decision = await Journal.value(attemptScope, 'catch', () =>
        this.#decide(clause, policy, ending, input, args, attemptScope),
      );

      if (!decision.ok)
        return {
          kind: EndingKind.Faulted,
          error: decision.error,
          retryAt: decision.retryAt,
        };

      const verdict = decision.value;

      if (verdict === Verdict.Uncaught) return ending;

      if (typeof verdict === 'number') {
        await durability.sleep(attemptScope.named('retry'), verdict);
        continue;
      }

      const spent = verdict === Verdict.Spent;
      return this.#handled(clause, ending.error, input, scope, runner, spent);
    }
  }

  // When this try runs its tasks again for a fault of the given attempt, or null; the time spent
  // counts from the try's start on the engine's clock. A fault it does not catch is for the
  // enclosing try.
  async #retryAt(
    clause: CatchClause,
    policy: RetryPolicy | null,
    error: JsonObject,
    attempt: number,
    firstAt: number,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<number | null> {
    const caught = await clause.catches(
      error,
      input,
      args,
      scope,
      this.evaluator,
    );

    if (!caught) return scope.retryAtOf(error);

    if (policy === null) return null;

    const now = scope.run.durability.stepTime();
    const elapsed = now - firstAt;
    const allowed =
      policy.allows(attempt, elapsed) &&
      (await clause.retries(policy, error, input, args, scope, this.evaluator));

    if (!allowed) return null;

    const delay = policy.delayAfter(attempt);
    return now + delay;
  }

  // Uncaught, handled without retry, retries spent, or the time left until the next attempt,
  // which was decided where the fault arose. The conditions are evaluated again so that one the
  // try cannot evaluate faults it.
  async #decide(
    clause: CatchClause,
    policy: RetryPolicy | null,
    ending: Fault,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<Verdict | number> {
    const error = ending.error;
    const caught = await clause.catches(
      error,
      input,
      args,
      scope,
      this.evaluator,
    );

    if (!caught) return Verdict.Uncaught;

    if (policy === null) return Verdict.Handled;

    const retries = await clause.retries(
      policy,
      error,
      input,
      args,
      scope,
      this.evaluator,
    );
    const retryAt = ending.retryAt;

    if (!retries || retryAt === null) return Verdict.Spent;

    const now = scope.run.durability.stepTime();
    return Math.max(retryAt - now, 0);
  }

  #handled(
    clause: CatchClause,
    error: JsonObject,
    input: JsonValue,
    scope: Scope,
    runner: Runner,
    spent: boolean,
  ): Promise<ListEnding> | ListEnding {
    const handler = clause.handler;

    if (handler !== null) {
      const variables = { [clause.variable]: error };
      const handlerScope = scope.child('catch').child('do').binding(variables);
      return runner.list(handler, input, handlerScope);
    }

    if (spent) return TryKind.#spent(error, scope);

    return { kind: EndingKind.Completed, output: input, ended: false };
  }

  // Spent retries without a handler fault the try itself, which an enclosing try may retry.
  static async #spent(error: JsonObject, scope: Scope): Promise<ListEnding> {
    const decided = await Journal.value(scope, 'spent', () =>
      scope.retryAtOf(error),
    );

    if (!decided.ok)
      return {
        kind: EndingKind.Faulted,
        error: decided.error,
        retryAt: decided.retryAt,
      };

    return { kind: EndingKind.Faulted, error, retryAt: decided.value };
  }

  static #listed(
    ending: Exclude<TaskEnding, { kind: EndingKind.Faulted }>,
  ): ListEnding {
    if (ending.kind === EndingKind.Stopped) return ending;

    const ended = ending.then === 'end';
    return { kind: EndingKind.Completed, output: ending.output, ended };
  }

  static #single(
    body: Specification.TaskList,
    kinds: TaskKindRegistry,
  ): TaskItem | null {
    if (body.length !== 1) return null;

    const [entry] = body;
    const [found] = Object.entries(entry ?? {});

    if (found === undefined) return null;

    const [name, task] = found;
    const leaf = kinds.leafOf(task);

    if (leaf === null) return null;

    return { name, task };
  }
}
