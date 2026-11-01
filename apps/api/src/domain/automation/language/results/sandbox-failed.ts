import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import type { ProcessReturn } from '../process-return.js';
import { Outcome } from '../outcome.js';
import { ProcessResult } from './process-result.js';

export class SandboxFailed extends ProcessResult {
  readonly #reason: string;

  constructor(id: string, reason: string) {
    super(id);
    this.#reason = reason;
  }

  outcome(returns: ProcessReturn, at: JsonPointer): Outcome {
    const error = ErrorType.Runtime.errorAt(at, this.#reason);
    return Outcome.failed(error);
  }
}
