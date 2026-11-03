import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { LeafKind, LeafResult } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import type { Scope } from '../scope.js';

// `set`: the task's output is the data it sets, its expressions evaluated.
export class SetKind implements LeafKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const set = (task as Specification.SetTask).set as JsonValue;
    const output = await this.evaluator.template(
      set,
      input,
      args,
      scope.pointer,
    );
    return { output, then: null };
  }
}
