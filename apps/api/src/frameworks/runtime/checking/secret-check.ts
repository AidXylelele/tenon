import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { JsonPointer } from '../document/json-pointer.js';
import { JsonWalk } from '../document/json-walk.js';

// A version names only its publisher's secrets (US8 AS4), and a secret-based authentication
// names one of those it declares in `use.secrets`.
export class SecretCheck {
  static readonly #SCHEMES = new Set([
    'basic',
    'bearer',
    'digest',
    'oauth2',
    'oidc',
  ]);
  static readonly #SKIPPED = new Set(['document']);

  static firstProblem(
    workflow: Specification.Workflow,
    owned: readonly string[],
  ): CheckProblem | null {
    const declared = workflow.use?.secrets ?? [];
    const at = JsonPointer.ROOT.child('use').child('secrets');

    for (const [index, name] of declared.entries()) {
      if (owned.includes(name)) continue;

      const pointer = at.child(String(index)).toString();
      return { pointer, detail: `'${name}' is not one of your secrets` };
    }

    return SecretCheck.#undeclared(workflow, declared);
  }

  static #undeclared(
    workflow: Specification.Workflow,
    declared: readonly string[],
  ): CheckProblem | null {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      SecretCheck.#SKIPPED,
    );

    for (const located of values) {
      const policy = located.value;
      const scheme =
        SecretCheck.#SCHEMES.has(located.key) &&
        policy !== null &&
        typeof policy === 'object' &&
        !Array.isArray(policy);

      if (!scheme) continue;

      const name = policy.use;

      if (typeof name !== 'string' || declared.includes(name)) continue;

      const pointer = located.pointer.child('use').toString();
      return { pointer, detail: `'${name}' is not declared in use.secrets` };
    }

    return null;
  }
}
