import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import type { ProcessReturn } from '../process-return.js';
import { Outcome } from '../outcome.js';
import { ProcessResult } from './process-result.js';

export class ProcessTimedOut extends ProcessResult {
  outcome(returns: ProcessReturn, at: JsonPointer): Outcome {
    const error = ErrorType.Timeout.errorAt(at, null);
    return Outcome.failed(error);
  }
}
