import { UnsupportedConstructError } from '../../../../domain/errors.js';
import {
  ClientAuthentication,
  UnsupportedConstruct,
} from '../../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import { TokenRequestEncoding } from '../enums.js';
import type * as Dsl from '../interfaces.js';
import { KnownPropertiesMapper } from './known-properties.mapper.js';

export class ClientCredentialsMapper {
  static readonly #SETTINGS: readonly string[] = [
    'authority',
    'grant',
    'client',
    'scopes',
    'audiences',
    'endpoints',
    'request',
  ];
  static readonly #CLIENT: readonly string[] = [
    'id',
    'secret',
    'authentication',
  ];
  static readonly #ENDPOINTS: readonly string[] = ['token'];
  static readonly #REQUEST: readonly string[] = ['encoding'];

  static confirm(settings: Dsl.SchemeSettings, at: JsonPointer): void {
    KnownPropertiesMapper.confirm(
      settings,
      ClientCredentialsMapper.#SETTINGS,
      at,
    );
    const client = settings.client ?? {};
    const clientAt = at.at('client');
    KnownPropertiesMapper.confirm(
      client,
      ClientCredentialsMapper.#CLIENT,
      clientAt,
    );
    const secretless = client.id === undefined || client.secret === undefined;

    if (secretless)
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ClientAuthentication,
        clientAt,
      );

    const methods: readonly string[] = Object.values(ClientAuthentication);
    const method = client.authentication ?? ClientAuthentication.SecretPost;

    if (!methods.includes(method)) {
      const methodAt = clientAt.at('authentication');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ClientAuthentication,
        methodAt,
      );
    }

    const endpoints = settings.endpoints ?? {};
    const endpointsAt = at.at('endpoints');
    KnownPropertiesMapper.confirm(
      endpoints,
      ClientCredentialsMapper.#ENDPOINTS,
      endpointsAt,
    );
    const request = settings.request ?? {};
    const requestAt = at.at('request');
    KnownPropertiesMapper.confirm(
      request,
      ClientCredentialsMapper.#REQUEST,
      requestAt,
    );
    const form: string = TokenRequestEncoding.Form;
    const encoding = request.encoding ?? form;

    if (encoding !== form) {
      const encodingAt = requestAt.at('encoding');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.TokenRequestEncoding,
        encodingAt,
      );
    }
  }
}
