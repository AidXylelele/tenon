import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { JqOutcomeKind } from '../enums.js';
import { Expressions } from '../document/expressions.js';
import { JsonWalk } from '../document/json-walk.js';
import type { DefinitionCheck, JqClient } from '../interfaces.js';

// Every runtime expression compiles, as a compiler checks syntax. `$secrets` is bound only in
// the workflow's `input.from`, so that secrets do not leak into the data (DSL 1.0.3).
export class ExpressionCheck implements DefinitionCheck {
  static readonly #SKIPPED = new Set(['document', 'code']);
  static readonly #SECRETS = /\$secrets\b/;
  static readonly #SECRETS_PLACE = '/input/from';

  constructor(private readonly jq: JqClient) {}

  async firstProblem(
    workflow: Specification.Workflow,
  ): Promise<CheckProblem | null> {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      ExpressionCheck.#SKIPPED,
    );

    for (const located of values) {
      const text = located.value;

      if (typeof text !== 'string' || !Expressions.encloses(text)) continue;

      const pointer = located.pointer.toString();
      const program = Expressions.programOf(text);
      const secrets = ExpressionCheck.#SECRETS.test(program);

      if (secrets && pointer !== ExpressionCheck.#SECRETS_PLACE)
        return {
          pointer,
          detail: '$secrets is available only in the workflow input.from',
        };

      const compiled = await this.jq.compile(program);

      if (compiled.kind === JqOutcomeKind.Compiled) continue;

      if (compiled.kind === JqOutcomeKind.Failure)
        return {
          pointer,
          detail: `the expression does not compile: ${compiled.failure}`,
        };

      return {
        pointer,
        detail: 'the expression cannot be compiled within its limits',
      };
    }

    return null;
  }
}
