import type { Backoff } from '../interfaces.js';

export class ConstantBackoff implements Backoff {
  delayFor(_attempt: number, delayMs: number): number {
    return delayMs;
  }
}
