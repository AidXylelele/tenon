import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { JsonSchemaOutcomeKind } from '../enums.js';
import { JsonWalk } from '../document/json-walk.js';
import type { DefinitionCheck, JsonSchemaClient } from '../interfaces.js';

// Every JSON Schema an author writes for an input, an output or an export compiles.
export class SchemaDocumentCheck implements DefinitionCheck {
  static readonly #SKIPPED = new Set(['document', 'code']);

  constructor(private readonly schemas: JsonSchemaClient) {}

  async firstProblem(
    workflow: Specification.Workflow,
  ): Promise<CheckProblem | null> {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      SchemaDocumentCheck.#SKIPPED,
    );

    for (const located of values) {
      if (located.key !== 'schema') continue;

      const schema = located.value as JsonObject;
      const document = schema.document as JsonObject | undefined;

      if (document === undefined) continue;

      const compiled = await this.schemas.compile(document);

      if (compiled.kind === JsonSchemaOutcomeKind.Compiled) continue;

      const pointer = located.pointer.child('document').toString();

      if (compiled.kind === JsonSchemaOutcomeKind.Unusable)
        return {
          pointer,
          detail: `the schema does not compile: ${compiled.reason}`,
        };

      return {
        pointer,
        detail: 'the schema cannot be compiled within its limits',
      };
    }

    return null;
  }
}
