import { Expression } from '../../../domain/automation/language/expression.js';
import { ExpressionDuration } from '../../../domain/automation/language/expression-duration.js';
import type { FixedDuration } from '../../../domain/automation/language/fixed-duration.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';
import { ExpressionMapper } from './expression.mapper.js';
import { FixedDurationMapper } from './fixed-duration.mapper.js';

export class DurationMapper {
  static toDomain(
    node: Dsl.Duration,
    at: JsonPointer,
  ): FixedDuration | ExpressionDuration {
    const runtime = typeof node === 'string' && Expression.isRuntime(node);

    if (!runtime) return FixedDurationMapper.toDomain(node, at);

    const expression = ExpressionMapper.toDomain(node, at);
    return new ExpressionDuration(expression);
  }
}
