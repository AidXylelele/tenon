import { BackoffKind } from '../../../domain/automation/language/enums.js';
import type * as Dsl from '../interfaces.js';

export class BackoffMapper {
  static toDomain(node: Dsl.Backoff | undefined): BackoffKind {
    if (node?.exponential !== undefined) return BackoffKind.Exponential;

    if (node?.linear !== undefined) return BackoffKind.Linear;

    return BackoffKind.Constant;
  }
}
