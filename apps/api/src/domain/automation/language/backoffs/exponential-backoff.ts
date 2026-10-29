import type { Backoff } from '../interfaces.js';

export class ExponentialBackoff implements Backoff {
  delayFor(attempt: number, delayMs: number): number {
    const factor = 2 ** (attempt - 1);
    return delayMs * factor;
  }
}
