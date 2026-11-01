import type { CallOutput } from '../call-output.js';
import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { ServiceResult } from './service-result.js';

export class CommunicationFailed extends ServiceResult {
  readonly #reason: string;

  constructor(id: string, reason: string) {
    super(id);
    this.#reason = reason;
  }

  outcome(output: CallOutput, at: JsonPointer): Outcome {
    const error = ErrorType.Communication.errorAt(at, this.#reason);
    return Outcome.failed(error);
  }
}
