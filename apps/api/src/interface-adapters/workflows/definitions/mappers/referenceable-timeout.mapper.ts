import type { ExpressionDuration } from '../../../../domain/automation/language/expression-duration.js';
import type { FixedDuration } from '../../../../domain/automation/language/fixed-duration.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import type * as Dsl from '../interfaces.js';
import { DurationMapper } from './duration.mapper.js';

export class ReferenceableTimeoutMapper {
  static toDomain(
    node: Dsl.Timeout | string | undefined,
    at: JsonPointer,
    components: ReusableComponents,
  ): FixedDuration | ExpressionDuration | null {
    if (node === undefined) return null;

    if (typeof node === 'string') return components.timeout(node, at);

    const afterAt = at.at('after');
    return DurationMapper.toDomain(node.after, afterAt);
  }
}
