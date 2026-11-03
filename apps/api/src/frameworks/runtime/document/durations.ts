import type { Specification } from '@openworkflowspec/sdk';
import { Expressions } from './expressions.js';

// A DSL duration: an ISO 8601 text or inline parts, and at run time possibly an expression.
// Calendar units have no fixed length, so they are refused like a negative or an
// uncomputable duration.
export class Durations {
  static readonly #CALENDAR =
    'calendar units (years, months, weeks) have no fixed length';
  static readonly #NEGATIVE = 'a duration cannot be negative';
  static readonly #MALFORMED = 'the duration cannot be computed';

  static isExpression(duration: Specification.Duration): boolean {
    return typeof duration === 'string' && Expressions.encloses(duration);
  }

  // Why a fixed duration cannot be used, or null when it can.
  static problemOf(duration: Specification.Duration): string | null {
    const parsed = Durations.#parsed(duration);

    if (parsed === null) return Durations.#MALFORMED;

    if (parsed.sign < 0) return Durations.#NEGATIVE;

    const calendar = parsed.years + parsed.months + parsed.weeks !== 0;

    if (calendar) return Durations.#CALENDAR;

    return null;
  }

  static millisecondsOf(duration: Specification.Duration): number {
    const parsed = Durations.#parsed(duration);

    if (parsed === null) throw new TypeError(Durations.#MALFORMED);

    return parsed.total({ unit: 'milliseconds' });
  }

  static #parsed(duration: Specification.Duration): Temporal.Duration | null {
    try {
      return Temporal.Duration.from(duration);
    } catch {
      return null;
    }
  }
}
