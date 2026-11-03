import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import { Durations } from '../../document/durations.js';
import { type CompositeKind, EndingKind, type ListEnding } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { ErrorKind, TaskFault } from '../faults.js';
import { Journal } from '../journal.js';
import type { Scope } from '../scope.js';

// `wait`: the instance waits, holding no worker (a durable sleep), then goes on with the same
// data. Past the workflow's deadline the task faults with a timeout instead.
export class WaitKind implements CompositeKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<ListEnding> {
    const run = scope.run;
    const wait = (task as Specification.WaitTask).wait ?? 'PT0S';
    const begun = await Journal.value(scope, 'wait', async () => {
      const milliseconds = await this.#millisecondsOf(wait, input, args, scope);
      await run.observer.waiting(run.plan.instanceId);
      return milliseconds;
    });

    if (!begun.ok) return { kind: EndingKind.Faulted, error: begun.error };

    const deadline = run.deadline;
    const now = run.durability.now();
    const remaining =
      deadline === null ? begun.value : Math.max(deadline - now, 0);
    const sleep = Math.min(begun.value, remaining);
    await run.durability.sleep(scope.named('sleep'), sleep);
    const overdue = sleep < begun.value;
    const ended = await Journal.value(scope, 'waited', async () => {
      await run.observer.running(run.plan.instanceId);

      if (overdue)
        throw TaskFault.of(
          ErrorKind.Timeout,
          scope.pointer,
          'The workflow outlasted its timeout',
        );

      return null;
    });

    if (!ended.ok) return { kind: EndingKind.Faulted, error: ended.error };

    return { kind: EndingKind.Completed, output: input, ended: false };
  }

  async #millisecondsOf(
    wait: Specification.Duration,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<number> {
    if (!Durations.isExpression(wait)) return Durations.millisecondsOf(wait);

    const evaluated = await this.evaluator.expression(
      wait as string,
      input,
      args,
      scope.pointer,
    );
    const duration = evaluated as Specification.Duration;
    const problem = Durations.problemOf(duration);

    if (problem !== null)
      throw TaskFault.of(
        ErrorKind.Expression,
        scope.pointer,
        `The wait ${problem}`,
      );

    return Durations.millisecondsOf(duration);
  }
}
