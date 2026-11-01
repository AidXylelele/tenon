import type { JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { WorkflowError } from '../workflow-error.js';

export abstract class EvaluationResult {
  readonly #id: string;
  readonly #value: JsonValue;

  constructor(id: string, value: JsonValue) {
    this.#id = id;
    this.#value = value;
  }

  get id(): string {
    return this.#id;
  }

  get value(): JsonValue {
    return this.#value;
  }

  abstract failure(at: JsonPointer): WorkflowError | null;
}
