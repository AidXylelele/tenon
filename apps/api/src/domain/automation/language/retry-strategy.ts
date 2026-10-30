import { NegativeAttemptCountError } from '../../errors.js';
import type { BackoffKind } from './enums.js';
import type { Expression } from './expression.js';
import type { FixedDuration } from './fixed-duration.js';
import type { RetryStrategyProps } from './interfaces.js';

export class RetryStrategy {
  readonly #when: Expression | null;
  readonly #exceptWhen: Expression | null;
  readonly #delay: FixedDuration | null;
  readonly #backoff: BackoffKind;
  readonly #attemptCount: number | null;
  readonly #attemptDuration: FixedDuration | null;
  readonly #totalDuration: FixedDuration | null;
  readonly #jitterFrom: FixedDuration | null;
  readonly #jitterTo: FixedDuration | null;

  constructor(props: RetryStrategyProps) {
    const count = props.attemptCount;
    const negative = count !== null && count < 0;

    if (negative) throw new NegativeAttemptCountError();

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

  get when(): Expression | null {
    return this.#when;
  }

  get exceptWhen(): Expression | null {
    return this.#exceptWhen;
  }

  get delay(): FixedDuration | null {
    return this.#delay;
  }

  get backoff(): BackoffKind {
    return this.#backoff;
  }

  get attemptCount(): number | null {
    return this.#attemptCount;
  }

  get attemptDuration(): FixedDuration | null {
    return this.#attemptDuration;
  }

  get totalDuration(): FixedDuration | null {
    return this.#totalDuration;
  }

  get jitterFrom(): FixedDuration | null {
    return this.#jitterFrom;
  }

  get jitterTo(): FixedDuration | null {
    return this.#jitterTo;
  }

  get expressions(): readonly Expression[] {
    const when = this.#when?.expressions ?? [];
    const exceptWhen = this.#exceptWhen?.expressions ?? [];
    return when.concat(exceptWhen);
  }
}
