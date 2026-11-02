import type {
  JsonObject,
  JsonValue,
  SchemaProps,
  Validation,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RoundResults } from './round-results.js';
import type { WorkflowError } from './workflow-error.js';
import type { WorkKey } from './work-key.js';

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

  validationsFor(key: WorkKey, data: JsonValue): readonly Validation[] {
    const id = key.idOf(this.#pointer);
    const validation: Validation = { id, schema: this.#document, data };
    return [validation];
  }

  failureIn(
    key: WorkKey,
    results: RoundResults,
    at: JsonPointer,
  ): WorkflowError | null {
    const id = key.idOf(this.#pointer);
    return results.failureOf(id, at);
  }
}
