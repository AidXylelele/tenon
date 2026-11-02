import type {
  JsonObject,
  JsonValue,
  SchemaProps,
  Validation,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';

export class Schema {
  readonly #pointer: JsonPointer;
  readonly #document: JsonObject;

  constructor(props: SchemaProps) {
    this.#pointer = props.pointer;
    this.#document = props.document;
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  get document(): JsonObject {
    return this.#document;
  }

  validationsFor(prefix: string, data: JsonValue): readonly Validation[] {
    const id = this.#pointer.idIn(prefix);
    const validation: Validation = { id, schema: this.#document, data };
    return [validation];
  }

  failureIn(
    prefix: string,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const id = this.#pointer.idIn(prefix);
    return results.failureOf(id, at);
  }
}
