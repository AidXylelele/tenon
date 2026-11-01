import type { CallOutput } from '../call-output.js';
import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { ServiceResult } from './service-result.js';

export class ServiceTimedOut extends ServiceResult {
  outcome(output: CallOutput, at: JsonPointer): Outcome {
    const error = ErrorType.Timeout.errorAt(at, null);
    return Outcome.failed(error);
  }
}
