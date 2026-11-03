import type { Specification } from '@openworkflowspec/sdk';
import { Phase } from '../../../../../domain/automation/instances/enums.js';
import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import {
  type CompositeKind,
  EndingKind,
  type ListEnding,
} from '../../endings.js';
import type { Evaluator } from '../../evaluator.js';
import { ErrorKind, TaskFault } from '../../faults.js';
import { Journal } from '../../journal.js';
import { ProcessCommands } from './process-commands.js';
import type { Scope } from '../../scope.js';

// `run: workflow`: the platform starts an instance of the version named, a child of this one.
// Awaited, its output is the task's and its fault the task's; detached (`await: false`), it runs
// on its own and the task goes on with its input.
export class WorkflowKind implements CompositeKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<ListEnding> {
    const run = scope.run;
    const declared = ((task as Specification.RunTask).run ?? {}) as JsonObject;
    const target = (declared.workflow ?? {}) as JsonObject;
    const detached = declared.await === false;
    const started = await Journal.value(scope, 'child', async () => {
      const childInput = await this.evaluator.template(
        target.input ?? {},
        input,
        args,
        scope.pointer,
      );
      const start = await run.observer.startChild(run.plan.instanceId, {
        namespace: ProcessCommands.textOf(target.namespace),
        name: ProcessCommands.textOf(target.name),
        version: ProcessCommands.textOf(target.version),
        input: childInput,
        detached,
      });

      if (start.childId === null)
        throw TaskFault.of(
          ErrorKind.Configuration,
          scope.pointer,
          start.refusal ?? 'The sub-workflow could not start',
        );

      return start.childId;
    });

    if (!started.ok) return { kind: EndingKind.Faulted, error: started.error };

    const childId = started.value;

    if (detached) {
      await run.durability.detachChild(scope.named('run'), childId);
      return { kind: EndingKind.Completed, output: input, ended: false };
    }

    await run.durability.awaitChild(scope.named('run'), childId);
    const ended = await Journal.value(scope, 'ended', async () => {
      const outcome = await run.observer.outcomeOf(childId);

      if (outcome.phase === Phase.Completed) return outcome.output;

      if (outcome.phase === Phase.Faulted)
        throw new TaskFault(outcome.error ?? {});

      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        'The sub-workflow did not complete',
      );
    });

    if (!ended.ok) return { kind: EndingKind.Faulted, error: ended.error };

    return { kind: EndingKind.Completed, output: ended.value, ended: false };
  }
}
