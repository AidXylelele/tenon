import { Endpoint } from '../../../../domain/automation/language/endpoint.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import type * as Dsl from '../interfaces.js';
import { ReferenceableAuthenticationMapper } from './referenceable-authentication.mapper.js';
import { TemplateMapper } from './template.mapper.js';

export class EndpointMapper {
  static toDomain(
    node: string | Dsl.Endpoint,
    at: JsonPointer,
    components: ReusableComponents,
  ): Endpoint {
    if (typeof node === 'string') {
      const uri = TemplateMapper.toDomain(node, at);
      return new Endpoint({ uri, authentication: null });
    }

    const uriAt = at.at('uri');
    const uri = TemplateMapper.toDomain(node.uri, uriAt);
    const authenticationAt = at.at('authentication');
    const authentication = ReferenceableAuthenticationMapper.toDomain(
      node.authentication,
      authenticationAt,
      components,
    );
    return new Endpoint({ uri, authentication });
  }
}
