import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { LeafKind, LeafResult } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import type { Scope } from '../scope.js';

// `switch`: the first case whose `when` holds, or that has none (a default), gives `then`;
// when none matches, the task's own `then` applies. The data passes through unchanged.
export class SwitchKind implements LeafKind {
  constructor(private readonly evaluator: Evaluator) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const cases = (task as Specification.SwitchTask).switch ?? [];

    for (const item of cases) {
      for (const match of Object.values(item)) {
        const when = match.when;
        const holds =
          when === undefined ||
          (await this.evaluator.condition(when, input, args, scope.pointer));

        if (holds) return { output: input, then: match.then };
      }
    }

    return { output: input, then: null };
  }
}
