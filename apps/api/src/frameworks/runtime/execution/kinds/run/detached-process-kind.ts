import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import type { GoJudgeCommand, SandboxLimits } from '../../../interfaces.js';
import {
  type CompositeKind,
  EndingKind,
  type ListEnding,
} from '../../endings.js';
import type { Evaluator } from '../../evaluator.js';
import { Journal } from '../../journal.js';
import type { Scope } from '../../scope.js';
import { ProcessCommands } from './process-commands.js';

// `run` with `await: false`: the process starts on its own and the task goes on with its input.
export class DetachedProcessKind implements CompositeKind {
  constructor(
    private readonly limits: SandboxLimits,
    private readonly evaluator: Evaluator,
  ) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<ListEnding> {
    const declared = ((task as Specification.RunTask).run ?? {}) as JsonValue;
    const built = await Journal.value(scope, 'command', async () => {
      const process = (await this.evaluator.template(
        declared,
        input,
        args,
        scope.pointer,
      )) as JsonObject;
      const command = ProcessCommands.of(process, this.limits);
      return command as unknown as JsonObject;
    });

    if (!built.ok) return { kind: EndingKind.Faulted, error: built.error };

    const command = built.value as unknown as GoJudgeCommand;
    await scope.run.durability.detachProcess(scope.named('process'), command);
    return { kind: EndingKind.Completed, output: input, ended: false };
  }
}
