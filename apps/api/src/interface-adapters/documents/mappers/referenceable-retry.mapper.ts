import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { RetryStrategy } from '../../../domain/automation/language/retry-strategy.js';
import type { ReusableComponents } from '../../../domain/automation/language/reusable-components.js';
import type * as Dsl from '../interfaces.js';
import { RetryStrategyMapper } from './retry-strategy.mapper.js';

export class ReferenceableRetryMapper {
  static toDomain(
    node: string | Dsl.RetryPolicy | undefined,
    at: JsonPointer,
    components: ReusableComponents,
  ): RetryStrategy | null {
    if (node === undefined) return null;

    if (typeof node === 'string') return components.retry(node, at);

    return RetryStrategyMapper.toDomain(node, at);
  }
}
