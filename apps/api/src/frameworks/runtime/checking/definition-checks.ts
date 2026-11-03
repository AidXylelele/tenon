import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import { VerdictKind } from '../../../interface-adapters/workflows/enums.js';
import type {
  CheckVerdict,
  RuntimeChecks,
} from '../../../interface-adapters/workflows/interfaces.js';
import type { DefinitionCheck } from '../interfaces.js';
import { EventTypes } from '../document/event-types.js';
import { Fingerprint } from './fingerprint.js';
import type { SchemaCheck } from './schema-check.js';

// What the runtime refuses to run, decided as a compiler would: the standard's schema first,
// then each check in turn; the first problem refuses the document (FR-002).
export class DefinitionChecks implements RuntimeChecks {
  constructor(
    private readonly schema: SchemaCheck,
    private readonly checks: readonly DefinitionCheck[],
  ) {}

  async check(document: JsonObject): Promise<CheckVerdict> {
    const schemaProblem = this.schema.problemOf(document);

    if (schemaProblem !== null)
      return { kind: VerdictKind.Invalid, problem: schemaProblem };

    const workflow = document as unknown as Specification.Workflow;

    for (const check of this.checks) {
      const problem = await check.firstProblem(workflow);

      if (problem !== null) return { kind: VerdictKind.Invalid, problem };
    }

    const declared = workflow.document;
    const fingerprint = Fingerprint.of(document);
    const eventTypes = DefinitionChecks.#eventTypesOf(workflow);
    const identity = {
      namespace: declared.namespace,
      name: declared.name,
      version: declared.version,
      dsl: declared.dsl,
      fingerprint,
      eventTypes,
    };
    return { kind: VerdictKind.Valid, identity };
  }

  // The types `schedule.on` starts instances on: null without it, empty when any type.
  static #eventTypesOf(workflow: Specification.Workflow): string[] | null {
    const on = (workflow.schedule as JsonObject | undefined)?.on;

    if (on === undefined) return null;

    const filters = EventTypes.filtersOf(on as JsonObject);
    return EventTypes.of(filters) ?? [];
  }
}
