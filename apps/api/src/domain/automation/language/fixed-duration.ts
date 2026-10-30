import {
  NegativeDurationError,
  UncomputableDurationError,
} from '../../errors.js';
import type { Expression } from './expression.js';
import type { InlineDurationParts } from './interfaces.js';

export class FixedDuration {
  readonly #value: Temporal.Duration;

  constructor(value: Temporal.Duration) {
    this.#value = value;
  }

  static inline(parts: InlineDurationParts): FixedDuration {
    const values = Object.values(parts);
    const negative = values.some((value) => value !== undefined && value < 0);

    if (negative) throw new NegativeDurationError();

    const value = Temporal.Duration.from(parts);
    return new FixedDuration(value);
  }

  static literal(text: string): FixedDuration {
    try {
      const value = Temporal.Duration.from(text);
      return new FixedDuration(value);
    } catch {
      throw new UncomputableDurationError();
    }
  }

  get value(): Temporal.Duration {
    return this.#value;
  }

  get expressions(): readonly Expression[] {
    return [];
  }
}
