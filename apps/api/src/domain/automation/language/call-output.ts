import { ErrorType } from './error-type.js';
import type { JsonPointer } from './json-pointer.js';
import { Outcome } from './outcome.js';
import type { OutputFormat } from './output-format.js';
import type { ServiceResponded } from './results/service-responded.js';

export class CallOutput {
  static readonly #REDIRECTION_FROM = 300;
  static readonly #ERROR_FROM = 400;

  readonly #format: OutputFormat;
  readonly #redirect: boolean;

  constructor(format: OutputFormat, redirect: boolean) {
    this.#format = format;
    this.#redirect = redirect;
  }

  outcomeOf(response: ServiceResponded, at: JsonPointer): Outcome {
    const status = response.status;
    const failed = status >= CallOutput.#ERROR_FROM;
    const redirected = status >= CallOutput.#REDIRECTION_FROM && !failed;
    const refused = failed || (redirected && !this.#redirect);

    if (refused) {
      const detail = `The service answered with status ${status}`;
      const error = ErrorType.Communication.errorWithStatus(status, at, detail);
      return Outcome.failed(error);
    }

    const output = this.#format.outputOf(response);
    return Outcome.responded(output, response.authorization);
  }
}
