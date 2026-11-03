import type { Specification } from '@openworkflowspec/sdk';
import { TaskStatus } from '../../../application/automation/instances/enums.js';
import { RunDirective } from '../../../domain/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import { Durations } from '../document/durations.js';
import type { StepOptions } from '../interfaces.js';
import type { DataFlow } from './data-flow.js';
import {
  type AttemptPolicy,
  type CompositeKind,
  EndingKind,
  type LeafKind,
  type ListEnding,
  type Runner,
  type TaskEnding,
  type TaskItem,
} from './endings.js';
import type { Evaluator } from './evaluator.js';
import { ErrorKind, RetryableFault, TaskFault } from './faults.js';
import type { TaskKindRegistry } from './task-kind-registry.js';
import type { Scope } from './scope.js';
import { TaskMoment } from './task-moment.js';

// The journaled result of a task's step: what the task produced and what the platform answered.
// `halted`: no task ran, because the run was stopped or the task's race was decided.
interface StepResult {
  readonly status: TaskStatus | null;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: JsonObject | null;
  readonly then: string | null;
  readonly context: JsonObject | null;
  readonly directive: RunDirective;
  readonly halted: boolean;
}

// A composite's start: also when it started and until when it may run.
interface Begun extends StepResult {
  readonly startedAt: number;
  readonly deadline: number | null;
}

type Journaled = StepResult & JsonObject;

type JournaledBegun = Begun & JsonObject;

// Runs task lists in the order `then` gives, and each task: a leaf as one engine step (its
// `if`, input, body, output and export together), a composite between a step that starts it
// and a step that ends it.
export class TaskRunner implements Runner {
  static readonly #ONCE: StepOptions = { timeoutMs: null, retry: null };
  static readonly #RECHECK_MS = 60_000;
  static readonly #HALTED: JournaledBegun = {
    status: null,
    input: null,
    output: null,
    error: null,
    then: null,
    context: null,
    directive: RunDirective.Stop,
    halted: true,
    startedAt: 0,
    deadline: null,
  };

  constructor(
    private readonly kinds: TaskKindRegistry,
    private readonly flow: DataFlow,
    private readonly evaluator: Evaluator,
  ) {}

  async list(
    list: Specification.TaskList,
    input: JsonValue,
    scope: Scope,
  ): Promise<ListEnding> {
    const visits = new Map<number, number>();
    let index = 0;
    let data = input;

    while (index < list.length) {
      const item = TaskRunner.#itemAt(list, index);
      const visit = (visits.get(index) ?? 0) + 1;
      visits.set(index, visit);
      const placed = scope.child(index).child(item.name);
      const taskScope =
        visit === 1 ? placed : placed.again(`~${String(visit)}`);
      const ending = await this.task(item, data, taskScope, null);

      if (ending.kind !== EndingKind.Completed) return ending;

      data = ending.output;
      const then = ending.then ?? 'continue';

      if (then === 'end')
        return { kind: EndingKind.Completed, output: data, ended: true };

      if (then === 'exit')
        return { kind: EndingKind.Completed, output: data, ended: false };

      index = then === 'continue' ? index + 1 : TaskRunner.#indexOf(list, then);
    }

    return { kind: EndingKind.Completed, output: data, ended: false };
  }

  task(
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
    policy: AttemptPolicy | null,
  ): Promise<TaskEnding> {
    const leaf = this.kinds.leafOf(item.task);

    if (leaf !== null) return this.#leaf(leaf, item, input, scope, policy);

    const composite = this.kinds.compositeOf(item.task);
    return this.#composite(composite, item, input, scope);
  }

  async #leaf(
    leaf: LeafKind,
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
    policy: AttemptPolicy | null,
  ): Promise<TaskEnding> {
    const durability = scope.run.durability;
    const options = { timeoutMs: null, retry: policy?.retry ?? null };
    const effect = (attempt: number) =>
      this.#leafStep(leaf, item, input, scope, policy, attempt);

    try {
      const result = await durability.step(scope.stepName, effect, options);
      return await this.#after(result, scope);
    } catch (error) {
      if (!(error instanceof TaskFault)) throw error;

      // A retry policy spent its attempts: the last fault ends the task.
      const failed = () =>
        this.#ended(
          item,
          scope,
          input,
          TaskStatus.Faulted,
          null,
          error.error,
          null,
          null,
        );
      const name = scope.named('failed');
      const result = await durability.step(name, failed, TaskRunner.#ONCE);
      return await this.#after(result, scope);
    }
  }

  async #leafStep(
    leaf: LeafKind,
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
    policy: AttemptPolicy | null,
    attempt: number,
  ): Promise<Journaled> {
    if (scope.halted) return TaskRunner.#HALTED;

    const task = item.task;
    const startedAt = await this.#started(item, scope, input);
    const started = TaskMoment.started(item, startedAt, input);

    try {
      const args = scope.argumentsFor(started);
      const guarded = await this.#passes(task, input, args, scope);

      if (!guarded)
        return await this.#ended(
          item,
          scope,
          input,
          TaskStatus.Skipped,
          input,
          null,
          null,
          null,
        );

      const taskInput = await this.flow.input(
        task.input,
        input,
        args,
        scope.pointer,
      );
      const given = started.given(taskInput);
      const taskArgs = scope.argumentsFor(given);
      const limit = await this.#limitOf(
        task,
        taskInput,
        taskArgs,
        scope,
        startedAt,
      );
      const work = () => leaf.run(task, taskInput, taskArgs, scope);
      const body = await TaskRunner.#within(work, limit, scope);
      const authorization = body.authorization ?? null;
      const produced = given.produced(body.output, authorization);
      const outputArgs = scope.argumentsFor(produced);
      const output = await this.flow.output(
        task.output,
        body.output,
        outputArgs,
        scope.pointer,
      );
      const transformed = produced.transformed(output);
      const exportArgs = scope.argumentsFor(transformed);
      const context = await this.flow.export(
        task.export,
        output,
        exportArgs,
        scope.pointer,
      );
      const then = body.then ?? task.then ?? null;
      return await this.#ended(
        item,
        scope,
        taskInput,
        TaskStatus.Completed,
        output,
        null,
        then,
        context,
      );
    } catch (error) {
      if (!(error instanceof TaskFault)) throw error;

      const retrying =
        policy !== null && (await policy.retries(error.error, attempt));

      if (retrying) throw new RetryableFault(error.error);

      return await this.#ended(
        item,
        scope,
        input,
        TaskStatus.Faulted,
        null,
        error.error,
        null,
        null,
      );
    }
  }

  async #composite(
    composite: CompositeKind,
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
  ): Promise<TaskEnding> {
    const durability = scope.run.durability;
    const task = item.task;
    const begin = () => this.#begin(item, input, scope);
    const begun = await durability.step(
      scope.named('start'),
      begin,
      TaskRunner.#ONCE,
    );
    const goesOn = begun.status === null && !begun.halted;

    if (!goesOn) return this.#after(begun, scope);

    const taskInput = begun.input;
    const bodyScope = scope.begun(begun.startedAt, begun.deadline);
    const started = TaskMoment.started(item, begun.startedAt, input);
    const given = started.given(taskInput);
    const args = bodyScope.argumentsFor(given);
    const body = await composite.run(task, taskInput, args, bodyScope, this);

    if (body.kind === EndingKind.Stopped) return body;

    const end = () => this.#finish(item, bodyScope, given, body);
    const finished = await durability.step(
      scope.named('end'),
      end,
      TaskRunner.#ONCE,
    );
    return this.#after(finished, scope);
  }

  // A composite's start: its `if`, its input and its deadline (its own timeout within the
  // enclosing ones); null as the status means it goes on.
  async #begin(
    item: TaskItem,
    input: JsonValue,
    scope: Scope,
  ): Promise<JournaledBegun> {
    if (scope.halted) return TaskRunner.#HALTED;

    const task = item.task;
    const startedAt = await this.#started(item, scope, input);
    const started = TaskMoment.started(item, startedAt, input);

    try {
      const args = scope.argumentsFor(started);
      const guarded = await this.#passes(task, input, args, scope);

      if (!guarded) {
        const skipped = await this.#ended(
          item,
          scope,
          input,
          TaskStatus.Skipped,
          input,
          null,
          null,
          null,
        );
        return TaskRunner.#begun(skipped, startedAt, null);
      }

      const taskInput = await this.flow.input(
        task.input,
        input,
        args,
        scope.pointer,
      );
      const given = started.given(taskInput);
      const taskArgs = scope.argumentsFor(given);
      const limit = await this.#limitOf(
        task,
        taskInput,
        taskArgs,
        scope,
        startedAt,
      );

      if (limit !== null && limit <= 0) throw TaskRunner.#timedOut(scope);

      const deadline = limit === null ? null : startedAt + limit;
      return {
        status: null,
        input: taskInput,
        output: null,
        error: null,
        then: null,
        context: null,
        directive: RunDirective.Continue,
        halted: false,
        startedAt,
        deadline,
      };
    } catch (error) {
      if (!(error instanceof TaskFault)) throw error;

      const faulted = await this.#ended(
        item,
        scope,
        input,
        TaskStatus.Faulted,
        null,
        error.error,
        null,
        null,
      );
      return TaskRunner.#begun(faulted, startedAt, null);
    }
  }

  static #begun(
    result: Journaled,
    startedAt: number,
    deadline: number | null,
  ): JournaledBegun {
    return {
      status: result.status,
      input: result.input,
      output: result.output,
      error: result.error,
      then: result.then,
      context: result.context,
      directive: result.directive,
      halted: result.halted,
      startedAt,
      deadline,
    };
  }

  async #finish(
    item: TaskItem,
    scope: Scope,
    given: TaskMoment,
    body: Exclude<ListEnding, { kind: EndingKind.Stopped }>,
  ): Promise<Journaled> {
    const task = item.task;
    const taskInput = given.input;

    if (body.kind === EndingKind.Faulted)
      return this.#ended(
        item,
        scope,
        taskInput,
        TaskStatus.Faulted,
        null,
        body.error,
        null,
        null,
      );

    try {
      const produced = given.produced(body.output, null);
      const args = scope.argumentsFor(produced);
      const output = await this.flow.output(
        task.output,
        body.output,
        args,
        scope.pointer,
      );
      const transformed = produced.transformed(output);
      const exportArgs = scope.argumentsFor(transformed);
      const context = await this.flow.export(
        task.export,
        output,
        exportArgs,
        scope.pointer,
      );
      const then = body.ended ? 'end' : (task.then ?? null);
      return await this.#ended(
        item,
        scope,
        taskInput,
        TaskStatus.Completed,
        output,
        null,
        then,
        context,
      );
    } catch (error) {
      if (!(error instanceof TaskFault)) throw error;

      return await this.#ended(
        item,
        scope,
        taskInput,
        TaskStatus.Faulted,
        null,
        error.error,
        null,
        null,
      );
    }
  }

  async #passes(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<boolean> {
    const condition = task.if;

    if (condition === undefined) return true;

    return this.evaluator.condition(condition, input, args, scope.pointer);
  }

  // The task's start, at the engine's time, which it returns.
  async #started(
    item: TaskItem,
    scope: Scope,
    input: JsonValue,
  ): Promise<number> {
    const run = scope.run;
    const startedAt = run.durability.stepTime();
    const at = new Date(startedAt).toISOString();
    const recorded = run.masked(input);
    await run.observer.taskStarted(run.plan.instanceId, {
      execution: scope.stepName,
      reference: scope.pointer.toString(),
      name: item.name,
      input: recorded,
      at,
    });
    return startedAt;
  }

  async #ended(
    item: TaskItem,
    scope: Scope,
    input: JsonValue,
    status: TaskStatus,
    output: JsonValue,
    error: JsonObject | null,
    then: string | null,
    context: JsonObject | null,
  ): Promise<Journaled> {
    const run = scope.run;
    const endedAt = run.durability.stepTime();
    const at = new Date(endedAt).toISOString();
    const recordedOutput = run.masked(output);
    const recordedError = error === null ? null : run.masked(error);
    const directive = await run.observer.taskEnded(run.plan.instanceId, {
      execution: scope.stepName,
      reference: scope.pointer.toString(),
      name: item.name,
      status,
      output: recordedOutput,
      error: recordedError,
      at,
    });

    // Stopped: the other branches of a fork must not start a task meanwhile.
    if (directive === RunDirective.Stop) run.stop();

    const halted = false;
    return { status, input, output, error, then, context, directive, halted };
  }

  // A step's result, applied where the run replays: its export replaces the context, and the
  // platform's answer stops the run or holds it until a resume.
  async #after(result: StepResult, scope: Scope): Promise<TaskEnding> {
    if (result.context !== null) scope.replaceContext(result.context);

    if (result.directive === RunDirective.Stop) {
      if (!result.halted) scope.run.stop();

      return { kind: EndingKind.Stopped };
    }

    if (result.directive === RunDirective.Suspend) {
      const held = await TaskRunner.#held(scope);

      if (!held) return { kind: EndingKind.Stopped };
    }

    if (result.status === TaskStatus.Faulted)
      return { kind: EndingKind.Faulted, error: result.error ?? {} };

    return {
      kind: EndingKind.Completed,
      output: result.output,
      then: result.then,
    };
  }

  // A suspended run waits for a resume and asks the instance again, so that a resume signal it
  // missed or one left from an earlier suspension never decides; false: it stopped meanwhile.
  static async #held(scope: Scope): Promise<boolean> {
    const run = scope.run;

    for (let check = 1; ; check += 1) {
      const marker = String(check);
      await run.durability.waitForResume(
        scope.named(`resume${marker}`),
        TaskRunner.#RECHECK_MS,
      );
      const ask = () => run.observer.directive(run.plan.instanceId);
      const directive = await run.durability.step(
        scope.named(`resumed${marker}`),
        ask,
        TaskRunner.#ONCE,
      );

      if (directive === RunDirective.Continue) return true;

      if (directive === RunDirective.Stop) {
        run.stop();
        return false;
      }
    }
  }

  // The milliseconds a task started `now` may run: its own timeout within the deadline the
  // enclosing timeouts set; null: no limit.
  async #limitOf(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
    now: number,
  ): Promise<number | null> {
    const own = await this.timeoutOf(task.timeout, input, args, scope);
    const deadline = scope.deadline;
    const remaining = deadline === null ? null : deadline - now;

    if (own === null) return remaining;

    if (remaining === null) return own;

    return Math.min(own, remaining);
  }

  // The milliseconds a timeout allows (DSL 1.0.3, "Timeout"), inline or declared by name in
  // `use.timeouts`; one written as an expression is evaluated now. Null: no timeout.
  async timeoutOf(
    declared: Specification.Task['timeout'],
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<number | null> {
    if (declared === undefined) return null;

    const timeouts = (scope.run.workflow.use?.timeouts ??
      {}) as unknown as JsonObject;
    const timeout =
      typeof declared === 'string'
        ? (timeouts[declared] as Specification.Timeout | undefined)
        : declared;
    const after = timeout?.after;

    if (after === undefined) return null;

    if (!Durations.isExpression(after)) return Durations.millisecondsOf(after);

    const evaluated = await this.evaluator.expression(
      after as string,
      input,
      args,
      scope.pointer,
    );
    const problem = Durations.problemOf(evaluated as Specification.Duration);

    if (problem !== null)
      throw TaskFault.of(
        ErrorKind.Expression,
        scope.pointer,
        `The timeout ${problem}`,
      );

    return Durations.millisecondsOf(evaluated as Specification.Duration);
  }

  // The task's work, faulted with a timeout error when it outlasts its limit (FR-014); a task
  // with no time left does not begin its work.
  static async #within<T>(
    work: () => Promise<T>,
    limit: number | null,
    scope: Scope,
  ): Promise<T> {
    if (limit === null) return work();

    if (limit <= 0) throw TaskRunner.#timedOut(scope);

    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(TaskRunner.#timedOut(scope));
      }, limit);
    });

    try {
      const working = work();
      return await Promise.race([working, expired]);
    } finally {
      clearTimeout(timer);
    }
  }

  static #timedOut(scope: Scope): TaskFault {
    return TaskFault.of(
      ErrorKind.Timeout,
      scope.pointer,
      'The task outlasted its timeout',
    );
  }

  static #itemAt(list: Specification.TaskList, index: number): TaskItem {
    const entry = list[index] ?? {};
    const [found] = Object.entries(entry);

    if (found === undefined)
      throw new TypeError('A task list entry names no task');

    const [name, task] = found;
    return { name, task };
  }

  static #indexOf(list: Specification.TaskList, name: string): number {
    const index = list.findIndex((item) => Object.hasOwn(item, name));

    if (index < 0) throw new TypeError(`No task named ${name} in this list`);

    return index;
  }
}
