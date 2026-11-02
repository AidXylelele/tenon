import { UnsupportedConstructError } from '../../../../domain/errors.js';
import type { Backoff } from '../../../../domain/automation/language/backoffs/backoff.js';
import { ConstantBackoff } from '../../../../domain/automation/language/backoffs/constant-backoff.js';
import { ExponentialBackoff } from '../../../../domain/automation/language/backoffs/exponential-backoff.js';
import { LinearBackoff } from '../../../../domain/automation/language/backoffs/linear-backoff.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';

export class BackoffMapper {
  static toDomain(node: Dsl.Backoff | undefined, at: JsonPointer): Backoff {
    if (node === undefined) return new ConstantBackoff();

    const parameters = node.exponential ?? node.linear ?? node.constant ?? {};
    const named = Object.keys(parameters).length > 0;

    if (named)
      throw new UnsupportedConstructError(
        UnsupportedConstruct.BackoffParameters,
        at,
      );

    if (node.exponential !== undefined) return new ExponentialBackoff();

    if (node.linear !== undefined) return new LinearBackoff();

    return new ConstantBackoff();
  }
}
