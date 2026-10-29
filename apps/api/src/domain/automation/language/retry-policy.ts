import { BackoffFactory } from './backoffs/backoff-factory.js';
import { DurationFactory } from './duration-factory.js';
import { Expression } from './expression.js';
import type { FixedDuration } from './fixed-duration.js';
import type {
  Backoff,
  ParsedRetryPolicy,
  RetryPolicyProps,
} from './interfaces.js';
import type { Scope } from './scope.js';

export class RetryPolicy {
  readonly #when: Expression | null;
  readonly #exceptWhen: Expression | null;
  readonly #delay: FixedDuration | null;
  readonly #backoff: Backoff;
  readonly #attemptCount: number | null;
  readonly #attemptDuration: FixedDuration | null;
  readonly #totalDuration: FixedDuration | null;
  readonly #jitterFrom: FixedDuration | null;
  readonly #jitterTo: FixedDuration | null;

  constructor(props: RetryPolicyProps) {
    this.#when = props.when;
    this.#exceptWhen = props.exceptWhen;
    this.#delay = props.delay;
    this.#backoff = props.backoff;
    this.#attemptCount = props.attemptCount;
    this.#attemptDuration = props.attemptDuration;
    this.#totalDuration = props.totalDuration;
    this.#jitterFrom = props.jitterFrom;
    this.#jitterTo = props.jitterTo;
  }

  static read(parsed: ParsedRetryPolicy, scope: Scope): RetryPolicy {
    const limitAt = scope.at('limit');
    const attemptAt = limitAt.at('attempt');
    const jitterAt = scope.at('jitter');
    const whenAt = scope.at('when');
    const exceptWhenAt = scope.at('exceptWhen');
    const delayAt = scope.at('delay');
    const countAt = attemptAt.at('count');
    const attemptDurationAt = attemptAt.at('duration');
    const totalDurationAt = limitAt.at('duration');
    const jitterFromAt = jitterAt.at('from');
    const jitterToAt = jitterAt.at('to');
    const attemptCount = parsed.limit?.attempt?.count ?? null;
    const negativeCount = attemptCount !== null && attemptCount < 0;

    if (negativeCount) countAt.refuse('An attempt count cannot be negative');

    const when = Expression.read(parsed.when, whenAt);
    const exceptWhen = Expression.read(parsed.exceptWhen, exceptWhenAt);
    const delay = DurationFactory.fixed(parsed.delay, delayAt);
    const backoff = BackoffFactory.read(parsed.backoff);
    const attemptDuration = DurationFactory.fixed(
      parsed.limit?.attempt?.duration,
      attemptDurationAt,
    );
    const totalDuration = DurationFactory.fixed(
      parsed.limit?.duration,
      totalDurationAt,
    );
    const jitterFrom = DurationFactory.fixed(parsed.jitter?.from, jitterFromAt);
    const jitterTo = DurationFactory.fixed(parsed.jitter?.to, jitterToAt);
    return new RetryPolicy({
      when,
      exceptWhen,
      delay,
      backoff,
      attemptCount,
      attemptDuration,
      totalDuration,
      jitterFrom,
      jitterTo,
    });
  }

  static resolve(
    parsed: string | ParsedRetryPolicy | undefined,
    scope: Scope,
  ): RetryPolicy | null {
    if (parsed === undefined) return null;

    if (typeof parsed === 'string')
      return scope.components.retry(parsed, scope);

    return RetryPolicy.read(parsed, scope);
  }

  get when(): Expression | null {
    return this.#when;
  }

  get exceptWhen(): Expression | null {
    return this.#exceptWhen;
  }

  get attemptDuration(): FixedDuration | null {
    return this.#attemptDuration;
  }

  allows(attempt: number, elapsedMs: number, now: Date): boolean {
    const exhausted =
      this.#attemptCount !== null && attempt > this.#attemptCount;

    if (exhausted) return false;

    if (this.#totalDuration === null) return true;

    const windowMs = this.#totalDuration.milliseconds(now);
    return elapsedMs < windowMs;
  }

  delayFor(attempt: number, jitterSample: number, now: Date): number {
    const delayMs = this.#delay?.milliseconds(now) ?? 0;
    const backedOffMs = this.#backoff.delayFor(attempt, delayMs);
    const jitterFromMs = this.#jitterFrom?.milliseconds(now) ?? 0;
    const jitterToMs = this.#jitterTo?.milliseconds(now) ?? jitterFromMs;
    const spreadMs = jitterToMs - jitterFromMs;
    const jitterMs = jitterFromMs + jitterSample * spreadMs;
    return backedOffMs + jitterMs;
  }
}
