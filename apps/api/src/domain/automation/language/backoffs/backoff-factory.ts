import type { Backoff, ParsedBackoff } from '../interfaces.js';
import { ConstantBackoff } from './constant-backoff.js';
import { ExponentialBackoff } from './exponential-backoff.js';
import { LinearBackoff } from './linear-backoff.js';

export class BackoffFactory {
  static read(parsed: ParsedBackoff | undefined): Backoff {
    if (parsed?.linear !== undefined) return new LinearBackoff();

    if (parsed?.exponential !== undefined) return new ExponentialBackoff();

    return new ConstantBackoff();
  }
}
