import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../../domain/automation/json.js';
import { Durations } from '../../document/durations.js';

// A retry policy (DSL 1.0.3, "Retry"): how many retries (`limit.attempt.count`), for how long
// (`limit.duration`), and the delay before each, grown by its backoff and spread by a jitter.
export class RetryPolicy {
  static readonly #UNBOUNDED = Number.MAX_SAFE_INTEGER;

  readonly #delay: number;
  readonly #backoff: string;
  readonly #retries: number;
  readonly #within: number | null;
  readonly #jitterFrom: number;
  readonly #jitterTo: number;
  readonly #when: string | null;
  readonly #exceptWhen: string | null;

  private constructor(policy: Specification.RetryPolicy) {
    this.#delay = RetryPolicy.#millisecondsOf(policy.delay) ?? 0;
    const backoff = (policy.backoff ?? {}) as JsonObject;
    this.#backoff = Object.keys(backoff)[0] ?? 'constant';
    this.#retries = policy.limit?.attempt?.count ?? RetryPolicy.#UNBOUNDED;
    this.#within = RetryPolicy.#millisecondsOf(policy.limit?.duration);
    this.#jitterFrom = RetryPolicy.#millisecondsOf(policy.jitter?.from) ?? 0;
    this.#jitterTo = RetryPolicy.#millisecondsOf(policy.jitter?.to) ?? 0;
    this.#when = policy.when ?? null;
    this.#exceptWhen = policy.exceptWhen ?? null;
  }

  // The policy a `catch` declares inline or by name in `use.retries`, or null.
  static of(
    retry: Specification.TryTaskCatch['retry'],
    declared: JsonObject,
  ): RetryPolicy | null {
    if (retry === undefined) return null;

    const policy =
      typeof retry === 'string'
        ? (declared[retry] as Specification.RetryPolicy | undefined)
        : retry;

    if (policy === undefined) return null;

    return new RetryPolicy(policy);
  }

  get when(): string | null {
    return this.#when;
  }

  get exceptWhen(): string | null {
    return this.#exceptWhen;
  }

  // Attempts in all: the first and every retry the count allows.
  get attempts(): number {
    if (this.#retries === RetryPolicy.#UNBOUNDED) return RetryPolicy.#UNBOUNDED;

    return this.#retries + 1;
  }

  // Whether the attempt that failed may be followed by another, `elapsed` ms after the first.
  allows(attempt: number, elapsed: number): boolean {
    const counted = attempt <= this.#retries;
    const timely = this.#within === null || elapsed < this.#within;
    return counted && timely;
  }

  // The delay before the retry that follows the given failed attempt.
  delayAfter(attempt: number): number {
    const grown = this.#grown(attempt);
    const spread = this.#jitterTo - this.#jitterFrom;
    const jitter = this.#jitterFrom + Math.random() * Math.max(spread, 0);
    return Math.round(grown + jitter);
  }

  #grown(attempt: number): number {
    if (this.#backoff === 'linear') return this.#delay * attempt;

    if (this.#backoff === 'exponential')
      return this.#delay * 2 ** (attempt - 1);

    return this.#delay;
  }

  static #millisecondsOf(
    duration: Specification.Duration | undefined,
  ): number | null {
    if (duration === undefined) return null;

    return Durations.millisecondsOf(duration);
  }
}
