import { NegativeAttemptCountError } from '../../errors.js';
import type { Backoff } from './backoffs/backoff.js';
import type { ErrorCondition } from './error-condition.js';
import type { Expression } from './expression.js';
import type { FixedDuration } from './fixed-duration.js';
import type { Attempt } from './attempt.js';
import { DueTime } from './due-time.js';
import type { RetryStrategyProps } from './interfaces.js';

export class RetryStrategy {
  static readonly #FNV_OFFSET = 0x811c9dc5;
  static readonly #FNV_PRIME = 0x01000193;
  static readonly #HASH_RANGE = 0x100000000;

  readonly #condition: ErrorCondition;
  readonly #delay: FixedDuration | null;
  readonly #backoff: Backoff;
  readonly #attemptCount: number | null;
  readonly #totalDuration: FixedDuration | null;
  readonly #jitterFrom: FixedDuration | null;
  readonly #jitterTo: FixedDuration | null;

  constructor(props: RetryStrategyProps) {
    const count = props.attemptCount;
    const negative = count !== null && count < 0;

    if (negative) throw new NegativeAttemptCountError();

    this.#condition = props.condition;
    this.#delay = props.delay;
    this.#backoff = props.backoff;
    this.#attemptCount = props.attemptCount;
    this.#totalDuration = props.totalDuration;
    this.#jitterFrom = props.jitterFrom;
    this.#jitterTo = props.jitterTo;
  }

  get condition(): ErrorCondition {
    return this.#condition;
  }

  get expressions(): readonly Expression[] {
    return this.#condition.expressions;
  }

  // When the attempt starts, none once the limits are spent. The jitter is sampled from the work
  // id, so a replay of the round derives the same time.
  resumesAt(attempt: Attempt, workId: string, now: Date): DueTime {
    const delay = this.#delayFor(attempt.count, workId);
    const allowed = this.#allows(attempt, delay, now);

    if (!allowed) return DueTime.None;

    const resumes = now.getTime() + delay;
    const at = new Date(resumes);
    return DueTime.of(at);
  }

  #delayFor(attempt: number, workId: string): number {
    const delay = this.#delay?.milliseconds ?? 0;
    const backedOff = this.#backoff.delayFor(delay, attempt);
    const from = this.#jitterFrom?.milliseconds ?? 0;
    const to = this.#jitterTo?.milliseconds ?? from;
    const sample = this.#sampleOf(workId);
    const jitter = from + (to - from) * sample;
    const total = backedOff + jitter;
    return Math.round(total);
  }

  #allows(attempt: Attempt, delay: number, now: Date): boolean {
    const counted =
      this.#attemptCount === null || attempt.count <= this.#attemptCount;
    const retryEnds = now.getTime() + delay;
    const firstStartedAt = attempt.firstStartedAt.getTime();
    const window = retryEnds - firstStartedAt;
    const windowLimit = this.#totalDuration?.milliseconds ?? Infinity;
    return counted && window <= windowLimit;
  }

  #sampleOf(workId: string): number {
    let hash = RetryStrategy.#FNV_OFFSET;

    for (const character of workId) {
      const code = character.codePointAt(0) ?? 0;
      const mixed = hash ^ code;
      hash = Math.imul(mixed, RetryStrategy.#FNV_PRIME) >>> 0;
    }

    return hash / RetryStrategy.#HASH_RANGE;
  }
}
