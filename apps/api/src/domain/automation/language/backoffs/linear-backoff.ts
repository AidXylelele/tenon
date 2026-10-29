import type { Backoff } from '../interfaces.js';

export class LinearBackoff implements Backoff {
  delayFor(attempt: number, delayMs: number): number {
    return delayMs * attempt;
  }
}
