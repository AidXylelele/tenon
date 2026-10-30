import type { Authentication } from '../../../domain/automation/language/authentication.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../domain/automation/language/reusable-components.js';
import type * as Dsl from '../interfaces.js';
import { AuthenticationMapper } from './authentication.mapper.js';

export class ReferenceableAuthenticationMapper {
  static toDomain(
    node: Dsl.Authentication | undefined,
    at: JsonPointer,
    components: ReusableComponents,
  ): Authentication | null {
    if (node === undefined) return null;

    if (node.use === undefined) return AuthenticationMapper.toDomain(node, at);

    const useAt = at.at('use');
    return components.authentication(node.use, useAt);
  }
}
