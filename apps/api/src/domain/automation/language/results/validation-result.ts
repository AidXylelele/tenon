import type { JsonPointer } from '../json-pointer.js';
import type { WorkflowError } from '../workflow-error.js';

export abstract class ValidationResult {
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  get id(): string {
    return this.#id;
  }

  abstract failure(at: JsonPointer): WorkflowError | null;
}
