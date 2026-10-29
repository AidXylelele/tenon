import { Expression } from './expression.js';
import { ExpressionDuration } from './expression-duration.js';
import { FixedDuration } from './fixed-duration.js';
import type { ParsedDuration, ParsedTimeout } from './interfaces.js';
import type { Scope } from './scope.js';
import { SupportedSubset } from './supported-subset.js';

export type Duration = FixedDuration | ExpressionDuration;

export class DurationFactory {
  static read(
    parsed: ParsedDuration | undefined,
    scope: Scope,
  ): Duration | null {
    if (parsed === undefined) return null;

    if (typeof parsed !== 'string') {
      const values = Object.values(parsed);
      const negative = values.some((value) => value < 0);

      if (negative) {
        scope.refuse('A duration cannot be negative');
        return null;
      }

      const inline = Temporal.Duration.from(parsed);
      return new FixedDuration(inline);
    }

    const isExpression = Expression.isRuntime(parsed);

    if (isExpression) {
      const expression = Expression.read(parsed, scope);
      return expression === null ? null : new ExpressionDuration(expression);
    }

    const accepted = SupportedSubset.acceptsDuration(parsed, scope);

    if (!accepted) return null;

    try {
      const literal = Temporal.Duration.from(parsed);
      return new FixedDuration(literal);
    } catch {
      scope.refuse('Not an ISO 8601 duration');
      return null;
    }
  }

  static fixed(
    parsed: ParsedDuration | undefined,
    scope: Scope,
  ): FixedDuration | null {
    const duration = DurationFactory.read(parsed, scope);

    if (duration instanceof ExpressionDuration) {
      SupportedSubset.refuse('retryExpression', scope);
      return null;
    }

    return duration;
  }

  static timeout(
    parsed: ParsedTimeout | string | undefined,
    scope: Scope,
  ): Duration | null {
    if (parsed === undefined) return null;

    if (typeof parsed === 'string')
      return scope.components.timeout(parsed, scope);

    const afterAt = scope.at('after');
    return DurationFactory.read(parsed.after, afterAt);
  }
}
