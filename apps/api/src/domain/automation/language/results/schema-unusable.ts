import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import type { WorkflowError } from '../workflow-error.js';
import { ValidationResult } from './validation-result.js';

// The author's schema itself cannot be used, which the standard calls a configuration error.
export class SchemaUnusable extends ValidationResult {
  readonly #reason: string;

  constructor(id: string, reason: string) {
    super(id);
    this.#reason = reason;
  }

  failure(at: JsonPointer): WorkflowError {
    return ErrorType.Configuration.errorAt(at, this.#reason);
  }
}
