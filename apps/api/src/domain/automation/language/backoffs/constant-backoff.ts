import { Backoff } from './backoff.js';

export class ConstantBackoff extends Backoff {
  delayFor(delay: number): number {
    return delay;
  }
}
