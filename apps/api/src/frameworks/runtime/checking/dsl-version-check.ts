import type { Specification } from '@openworkflowspec/sdk';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import type { DefinitionCheck } from '../interfaces.js';

// The released DSL versions only (FR-001): a pre-release has a schema of its own.
export class DslVersionCheck implements DefinitionCheck {
  static readonly #RELEASED = ['1.0.0', '1.0.1', '1.0.2', '1.0.3'];

  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null> {
    const dsl = workflow.document.dsl;
    const released = DslVersionCheck.#RELEASED.includes(dsl);

    if (released) return Promise.resolve(null);

    const problem = {
      pointer: '/document/dsl',
      detail: `DSL ${dsl} is not supported: only the released versions 1.0.0 to 1.0.3 are`,
    };
    return Promise.resolve(problem);
  }
}
