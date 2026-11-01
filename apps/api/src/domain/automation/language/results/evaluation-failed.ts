import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import type { WorkflowError } from '../workflow-error.js';
import { EvaluationResult } from './evaluation-result.js';

export class EvaluationFailed extends EvaluationResult {
  readonly #reason: string;

  constructor(id: string, reason: string) {
    super(id, null);
    this.#reason = reason;
  }

  failure(at: JsonPointer): WorkflowError {
    return ErrorType.Expression.errorAt(at, this.#reason);
  }
}
