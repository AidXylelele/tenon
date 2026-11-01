import { Backoff } from './backoff.js';

export class ExponentialBackoff extends Backoff {
  static readonly #BASE = 2;

  delayFor(delay: number, attempt: number): number {
    const exponent = attempt - 1;
    const factor = ExponentialBackoff.#BASE ** exponent;
    return delay * factor;
  }
}
