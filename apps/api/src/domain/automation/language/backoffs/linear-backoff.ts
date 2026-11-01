import { Backoff } from './backoff.js';

export class LinearBackoff extends Backoff {
  delayFor(delay: number, attempt: number): number {
    return delay * attempt;
  }
}
