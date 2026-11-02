import {
  AuthenticationScheme,
  CallKind,
  ClientAuthentication,
  OAuth2Endpoint,
} from '../../../../domain/automation/language/enums.js';
import type {
  JsonValue,
  ServiceAuthentication,
  ServiceCall,
} from '../../../../domain/automation/language/interfaces.js';
import { AuthorizationKind } from '../enums.js';
import type { Authorization } from '../interfaces.js';
import { HttpRequestMapper } from './http-request.mapper.js';

export class AuthorizationMapper {
  static readonly #TRAILING_SLASH = /\/$/;

  static ofCall(call: ServiceCall): Authorization | null {
    if (call.kind === CallKind.Http)
      return AuthorizationMapper.toAuthorization(call.endpoint.authentication);

    return AuthorizationMapper.toAuthorization(call.authentication);
  }

  static toAuthorization(
    authentication: ServiceAuthentication | null,
  ): Authorization | null {
    if (authentication === null) return null;

    const settings = HttpRequestMapper.objectOf(authentication.settings);

    if (authentication.scheme === AuthenticationScheme.Basic) {
      const username = HttpRequestMapper.textOf(settings.username);
      const password = HttpRequestMapper.textOf(settings.password);
      const credentials = Buffer.from(`${username}:${password}`, 'utf8');
      const parameter = credentials.toString('base64');
      return { kind: AuthorizationKind.Header, scheme: 'Basic', parameter };
    }

    if (authentication.scheme === AuthenticationScheme.Bearer) {
      const parameter = HttpRequestMapper.textOf(settings.token);
      return { kind: AuthorizationKind.Header, scheme: 'Bearer', parameter };
    }

    const declared = HttpRequestMapper.textOf(settings.authority);
    const authority = declared.replace(AuthorizationMapper.#TRAILING_SLASH, '');
    const client = HttpRequestMapper.objectOf(settings.client);
    const clientId = HttpRequestMapper.textOf(client.id);
    const clientSecret = HttpRequestMapper.textOf(client.secret);
    const secretInHeader =
      client.authentication === ClientAuthentication.SecretBasic;
    const scopes = AuthorizationMapper.#textsOf(settings.scopes);
    const audiences = AuthorizationMapper.#textsOf(settings.audiences);
    const oauth2 = authentication.scheme === AuthenticationScheme.OAuth2;
    const endpoints = HttpRequestMapper.objectOf(settings.endpoints);
    const tokenPath =
      HttpRequestMapper.textOf(endpoints.token) || OAuth2Endpoint.Token;
    const tokenEndpoint = oauth2 ? `${authority}${tokenPath}` : null;
    const issuer = oauth2 ? null : authority;
    return {
      kind: AuthorizationKind.ClientCredentials,
      tokenEndpoint,
      issuer,
      clientId,
      clientSecret,
      secretInHeader,
      scopes,
      audiences,
    };
  }

  static #textsOf(value: JsonValue | undefined): readonly string[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => HttpRequestMapper.textOf(item));
  }
}
