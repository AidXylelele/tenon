import { UnsupportedConstructError } from '../../../../domain/errors.js';
import { Authentication } from '../../../../domain/automation/language/authentication.js';
import {
  AuthenticationScheme,
  UnsupportedConstruct,
} from '../../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import { OAuth2Grant } from '../enums.js';
import type * as Dsl from '../interfaces.js';
import { ClientCredentialsMapper } from './client-credentials.mapper.js';
import { KnownPropertiesMapper } from './known-properties.mapper.js';
import { TemplateMapper } from './template.mapper.js';

export class AuthenticationMapper {
  static toDomain(node: Dsl.Authentication, at: JsonPointer): Authentication {
    if (node.digest !== undefined) {
      const digestAt = at.at('digest');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Digest,
        digestAt,
      );
    }

    const schemes = Object.values(AuthenticationScheme);
    const grants: readonly string[] = Object.values(OAuth2Grant);
    const known: readonly string[] = schemes;
    KnownPropertiesMapper.confirm(node, known, at);

    for (const scheme of schemes) {
      const settings = node[scheme];

      if (settings === undefined) continue;

      const schemeAt = at.at(scheme);

      if (settings.use !== undefined) {
        const useAt = schemeAt.at('use');
        throw new UnsupportedConstructError(
          UnsupportedConstruct.SecretAuthentication,
          useAt,
        );
      }

      const grantFree =
        scheme === AuthenticationScheme.Basic ||
        scheme === AuthenticationScheme.Bearer;
      const grant = settings.grant ?? '';
      const supportedGrant = grants.includes(grant);

      if (!grantFree && !supportedGrant) {
        const grantAt = schemeAt.at('grant');
        throw new UnsupportedConstructError(
          UnsupportedConstruct.Grant,
          grantAt,
        );
      }

      if (!grantFree) ClientCredentialsMapper.confirm(settings, schemeAt);

      const template = TemplateMapper.toDomain(settings, schemeAt);
      return new Authentication({ scheme, settings: template });
    }

    throw new UnsupportedConstructError(
      UnsupportedConstruct.UnknownProperty,
      at,
    );
  }
}
