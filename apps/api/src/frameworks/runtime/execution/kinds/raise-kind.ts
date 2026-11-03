import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { LeafKind, LeafResult } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import { TaskFault } from '../faults.js';
import type { Scope } from '../scope.js';

// `raise`: faults the task with the error it declares inline or by name in `use.errors`; the
// error's instance is the task unless it names one.
export class RaiseKind implements LeafKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const declared = (task as Specification.RaiseTask).raise?.error;
    const errors = (scope.run.workflow.use?.errors ??
      {}) as unknown as JsonObject;
    const definition = (
      typeof declared === 'string' ? errors[declared] : declared
    ) as JsonValue;
    const filled = await this.evaluator.template(
      definition,
      input,
      args,
      scope.pointer,
    );
    const error: Record<string, JsonValue> = {};
    Object.assign(error, filled);
    error.instance ??= scope.pointer.toString();
    throw new TaskFault(error);
  }
}
