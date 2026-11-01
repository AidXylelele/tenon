import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import type { WorkflowError } from '../workflow-error.js';
import { ValidationResult } from './validation-result.js';

export class ValidationFailed extends ValidationResult {
  readonly #reason: string;

  constructor(id: string, reason: string) {
    super(id);
    this.#reason = reason;
  }

  failure(at: JsonPointer): WorkflowError {
    return ErrorType.Validation.errorAt(at, this.#reason);
  }
}
