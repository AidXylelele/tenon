import {
  CalendarDurationError,
  InvalidDocumentValueError,
  InvalidValueError,
  UncomputableDurationError,
  UnsupportedConstructError,
} from '../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import { Expression } from '../../../../domain/automation/language/expression.js';
import { FixedDuration } from '../../../../domain/automation/language/fixed-duration.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';

export class FixedDurationMapper {
  static toDomain(node: Dsl.Duration, at: JsonPointer): FixedDuration;
  static toDomain(
    node: Dsl.Duration | undefined,
    at: JsonPointer,
  ): FixedDuration | null;
  static toDomain(
    node: Dsl.Duration | undefined,
    at: JsonPointer,
  ): FixedDuration | null {
    if (node === undefined) return null;

    const runtime = typeof node === 'string' && Expression.isRuntime(node);

    if (runtime)
      throw new UnsupportedConstructError(
        UnsupportedConstruct.RetryExpression,
        at,
      );

    try {
      if (typeof node === 'string') return FixedDuration.literal(node);

      return FixedDuration.inline(node);
    } catch (error) {
      if (error instanceof UncomputableDurationError)
        throw new UnsupportedConstructError(
          UnsupportedConstruct.FractionalDuration,
          at,
        );

      if (error instanceof CalendarDurationError)
        throw new UnsupportedConstructError(
          UnsupportedConstruct.CalendarDuration,
          at,
        );

      if (error instanceof InvalidValueError)
        throw new InvalidDocumentValueError(at, error);

      throw error;
    }
  }
}
