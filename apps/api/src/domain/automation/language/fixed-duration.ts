import {
  CalendarDurationError,
  MalformedDurationError,
  NegativeDurationError,
  UncomputableDurationError,
} from '../../errors.js';
import type { Expression } from './expression.js';
import type {
  Evaluation,
  InlineDurationParts,
  JsonValue,
} from './interfaces.js';
import type { WorkflowError } from './workflow-error.js';

export class FixedDuration {
  readonly #value: Temporal.Duration;

  constructor(value: Temporal.Duration) {
    if (value.sign < 0) throw new NegativeDurationError();

    const calendar = value.years + value.months + value.weeks !== 0;

    if (calendar) throw new CalendarDurationError();

    this.#value = value;
  }

  static inline(parts: InlineDurationParts): FixedDuration {
    const value = FixedDuration.#parsed(parts);
    return new FixedDuration(value);
  }

  static literal(text: string): FixedDuration {
    const value = FixedDuration.#parsed(text);
    return new FixedDuration(value);
  }

  static fromValue(value: JsonValue): FixedDuration {
    if (typeof value === 'string') return FixedDuration.literal(value);

    const inline =
      typeof value === 'object' && value !== null && !Array.isArray(value);

    if (!inline) throw new MalformedDurationError();

    const parts: InlineDurationParts = {
      days: FixedDuration.#numberOf(value.days),
      hours: FixedDuration.#numberOf(value.hours),
      minutes: FixedDuration.#numberOf(value.minutes),
      seconds: FixedDuration.#numberOf(value.seconds),
      milliseconds: FixedDuration.#numberOf(value.milliseconds),
    };
    return FixedDuration.inline(parts);
  }

  static #parsed(input: string | InlineDurationParts): Temporal.Duration {
    try {
      return Temporal.Duration.from(input);
    } catch {
      throw new UncomputableDurationError();
    }
  }

  static #numberOf(value: JsonValue | undefined): number | undefined {
    if (value === undefined) return undefined;

    if (typeof value !== 'number') throw new MalformedDurationError();

    return value;
  }

  get value(): Temporal.Duration {
    return this.#value;
  }

  get milliseconds(): number {
    return this.#value.total({ unit: 'milliseconds' });
  }

  endFrom(start: Date): Date {
    const end = start.getTime() + this.milliseconds;
    return new Date(end);
  }

  resolve(): this {
    return this;
  }

  evaluationsFor(): readonly Evaluation[] {
    return [];
  }

  failureIn(): WorkflowError | null {
    return null;
  }

  get expressions(): readonly Expression[] {
    return [];
  }
}
