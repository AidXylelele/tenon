import { Injectable } from '@nestjs/common';
import {
  BulkheadFullError,
  ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import { request as send } from 'undici';
import { ServiceCaller } from '../../application/automation/instances/ports.js';
import {
  AuthenticationScheme,
  CallKind,
} from '../../domain/automation/language/enums.js';
import type {
  JsonObject,
  JsonValue,
  ServiceAuthentication,
  ServiceCall,
} from '../../domain/automation/language/interfaces.js';
import { AuthenticationFailed } from '../../domain/automation/language/results/authentication-failed.js';
import { CallMisconfigured } from '../../domain/automation/language/results/call-misconfigured.js';
import { CommunicationFailed } from '../../domain/automation/language/results/communication-failed.js';
import { ServiceResponded } from '../../domain/automation/language/results/service-responded.js';
import type { ServiceResult } from '../../domain/automation/language/results/service-result.js';
import { ServiceTimedOut } from '../../domain/automation/language/results/service-timed-out.js';
import { CallConfigurationError } from './call-configuration.error.js';
import { CommunicationError } from './communication.error.js';
import {
  type Authorization,
  EndpointDispatcher,
  type HttpRequest,
  type HttpResponse,
} from './interfaces.js';
import { HttpRequestMapper } from './mappers/http-request.mapper.js';
import { OpenApiRequestMapper } from './mappers/openapi-request.mapper.js';
import { TokenRequestError } from './token-request.error.js';

@Injectable()
export class HttpServiceCaller implements ServiceCaller {
  private static readonly PRESET = 'service-calls';
  private static readonly MAXIMUM_BYTES = 1024 * 1024;
  private static readonly RAW = 'raw';
  private static readonly TOKEN_PATH = '/oauth2/token';
  private static readonly DISCOVERY = '/.well-known/openid-configuration';
  private static readonly SECRET_BASIC = 'client_secret_basic';
  private static readonly UNREACHABLE = 'The service could not be reached';
  private static readonly TOO_LARGE = 'The response is larger than 1 MiB';
  private static readonly TOKEN_REFUSED =
    'The authorization server refused the client credentials';
  private static readonly NOT_A_DOCUMENT =
    'The OpenAPI document could not be read';
  private static readonly NOT_A_URI = 'The endpoint is not a valid URI';

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly dispatcher: EndpointDispatcher,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(HttpServiceCaller.PRESET);
  }

  async callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]> {
    const settled = await Promise.all(calls.map((call) => this.#call(call)));
    return settled.filter((result) => result !== null);
  }

  async #call(call: ServiceCall): Promise<ServiceResult | null> {
    try {
      return await this.policy.execute(({ signal }) =>
        this.#perform(call, signal),
      );
    } catch (error) {
      return this.#resultOf(call, error);
    }
  }

  #resultOf(call: ServiceCall, error: unknown): ServiceResult | null {
    if (error instanceof BulkheadFullError) return null;

    if (error instanceof ResilienceTimeoutError)
      return new ServiceTimedOut(call.id);

    if (error instanceof CallConfigurationError)
      return new CallMisconfigured(call.id, error.message);

    if (error instanceof TokenRequestError)
      return new AuthenticationFailed(call.id, error.message);

    if (error instanceof CommunicationError)
      return new CommunicationFailed(call.id, error.message);

    const transport =
      error instanceof Error && typeof Reflect.get(error, 'code') === 'string';

    if (transport)
      return new CommunicationFailed(call.id, HttpServiceCaller.UNREACHABLE);

    throw error;
  }

  async #perform(
    call: ServiceCall,
    signal: AbortSignal,
  ): Promise<ServiceResult> {
    const prepared = await this.#requestOf(call, signal);
    const authentication = this.#authenticationOf(call);
    const authorization = await this.#authorize(authentication, signal);
    const headers: Record<string, string> = {};

    for (const name of Object.keys(prepared.headers))
      headers[name] = prepared.headers[name] ?? '';

    if (authorization !== null)
      headers.authorization = `${authorization.scheme} ${authorization.parameter}`;

    const request: HttpRequest = {
      method: prepared.method,
      url: prepared.url,
      headers,
      body: prepared.body,
    };
    const response = await this.#send(request, signal);
    const args = HttpRequestMapper.objectOf(call.arguments);
    const raw = args.output === HttpServiceCaller.RAW;
    const content = this.#contentOf(response, raw);
    return new ServiceResponded({
      id: call.id,
      status: response.status,
      headers: response.headers,
      content,
      request: {
        method: request.method,
        uri: request.url,
        headers: request.headers,
      },
      authorization: this.#describe(authorization),
    });
  }

  async #requestOf(
    call: ServiceCall,
    signal: AbortSignal,
  ): Promise<HttpRequest> {
    try {
      if (call.kind === CallKind.Http) return HttpRequestMapper.toRequest(call);

      const location = HttpRequestMapper.textOf(call.endpoint.uri);
      const document = await this.#document(call, location, signal);
      return OpenApiRequestMapper.toRequest(call, document, location);
    } catch (error) {
      if (error instanceof TypeError)
        throw new CallConfigurationError(HttpServiceCaller.NOT_A_URI);

      throw error;
    }
  }

  async #document(
    call: ServiceCall,
    location: string,
    signal: AbortSignal,
  ): Promise<JsonObject> {
    const authorization = await this.#authorize(
      call.endpoint.authentication,
      signal,
    );
    const headers: Record<string, string> = {};

    if (authorization !== null)
      headers.authorization = `${authorization.scheme} ${authorization.parameter}`;

    const response = await this.#send(
      { method: 'GET', url: location, headers, body: null },
      signal,
    );

    if (response.status >= 300)
      throw new CallConfigurationError(HttpServiceCaller.NOT_A_DOCUMENT);

    const text = response.body.toString('utf8');

    try {
      const dereferenced: unknown = await $RefParser.dereference(location, {
        resolve: {
          external: false,
          file: false,
          http: false,
          fetched: { order: 1, canRead: true, read: () => text },
        },
      });
      return HttpRequestMapper.objectOf(dereferenced as JsonValue);
    } catch {
      throw new CallConfigurationError(HttpServiceCaller.NOT_A_DOCUMENT);
    }
  }

  #authenticationOf(call: ServiceCall): ServiceAuthentication | null {
    if (call.kind === CallKind.Http) return call.endpoint.authentication;

    return call.authentication;
  }

  async #authorize(
    authentication: ServiceAuthentication | null,
    signal: AbortSignal,
  ): Promise<Authorization | null> {
    if (authentication === null) return null;

    const settings = HttpRequestMapper.objectOf(authentication.settings);

    if (authentication.scheme === AuthenticationScheme.Basic) {
      const username = HttpRequestMapper.textOf(settings.username);
      const password = HttpRequestMapper.textOf(settings.password);
      const credentials = Buffer.from(`${username}:${password}`, 'utf8');
      return { scheme: 'Basic', parameter: credentials.toString('base64') };
    }

    if (authentication.scheme === AuthenticationScheme.Bearer) {
      const token = HttpRequestMapper.textOf(settings.token);
      return { scheme: 'Bearer', parameter: token };
    }

    const endpoint = await this.#tokenEndpoint(authentication, signal);
    return this.#token(endpoint, settings, signal);
  }

  async #tokenEndpoint(
    authentication: ServiceAuthentication,
    signal: AbortSignal,
  ): Promise<string> {
    const settings = HttpRequestMapper.objectOf(authentication.settings);
    const authority = HttpRequestMapper.textOf(settings.authority).replace(
      /\/$/,
      '',
    );

    if (authentication.scheme === AuthenticationScheme.OAuth2) {
      const endpoints = HttpRequestMapper.objectOf(settings.endpoints);
      const path =
        HttpRequestMapper.textOf(endpoints.token) ||
        HttpServiceCaller.TOKEN_PATH;
      return `${authority}${path}`;
    }

    const discovery = await this.#send(
      {
        method: 'GET',
        url: `${authority}${HttpServiceCaller.DISCOVERY}`,
        headers: {},
        body: null,
      },
      signal,
    );
    const configuration = this.#jsonOf(discovery);
    const endpoint = configuration.token_endpoint;

    if (discovery.status >= 300 || typeof endpoint !== 'string')
      throw new TokenRequestError(HttpServiceCaller.TOKEN_REFUSED);

    return endpoint;
  }

  async #token(
    endpoint: string,
    settings: JsonObject,
    signal: AbortSignal,
  ): Promise<Authorization> {
    const client = HttpRequestMapper.objectOf(settings.client);
    const id = HttpRequestMapper.textOf(client.id);
    const secret = HttpRequestMapper.textOf(client.secret);
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    const headers: Record<string, string> = {
      'content-type': 'application/x-www-form-urlencoded',
    };
    const scopes = Array.isArray(settings.scopes) ? settings.scopes : [];
    const audiences = Array.isArray(settings.audiences)
      ? settings.audiences
      : [];

    if (scopes.length > 0)
      form.set(
        'scope',
        scopes.map((scope) => HttpRequestMapper.textOf(scope)).join(' '),
      );

    for (const audience of audiences)
      form.append('audience', HttpRequestMapper.textOf(audience));

    if (client.authentication === HttpServiceCaller.SECRET_BASIC) {
      const credentials = Buffer.from(`${id}:${secret}`, 'utf8');
      headers.authorization = `Basic ${credentials.toString('base64')}`;
    } else {
      form.set('client_id', id);
      form.set('client_secret', secret);
    }

    const response = await this.#send(
      { method: 'POST', url: endpoint, headers, body: form.toString() },
      signal,
    );
    const granted = this.#jsonOf(response);
    const token = granted.access_token;

    if (response.status >= 300 || typeof token !== 'string')
      throw new TokenRequestError(HttpServiceCaller.TOKEN_REFUSED);

    return { scheme: 'Bearer', parameter: token };
  }

  async #send(
    request: HttpRequest,
    signal: AbortSignal,
  ): Promise<HttpResponse> {
    const response = await send(request.url, {
      dispatcher: this.dispatcher,
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;

      if (size > HttpServiceCaller.MAXIMUM_BYTES) {
        response.body.destroy();
        throw new CommunicationError(HttpServiceCaller.TOO_LARGE);
      }

      chunks.push(bytes);
    }

    const headers: Record<string, string> = {};

    for (const name of Object.keys(response.headers)) {
      const value = response.headers[name];
      headers[name] = Array.isArray(value) ? value.join(', ') : (value ?? '');
    }

    const body = Buffer.concat(chunks);
    return { status: response.statusCode, headers, body };
  }

  #contentOf(response: HttpResponse, raw: boolean): JsonValue {
    if (raw) return response.body.toString('base64');

    const type = response.headers['content-type'] ?? '';
    const text = response.body.toString('utf8');

    if (!type.includes('json') || text === '') return text;

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  #jsonOf(response: HttpResponse): JsonObject {
    const text = response.body.toString('utf8');

    try {
      const parsed = JSON.parse(text) as JsonValue;
      return HttpRequestMapper.objectOf(parsed);
    } catch {
      return {};
    }
  }

  #describe(authorization: Authorization | null): JsonObject | null {
    if (authorization === null) return null;

    return {
      scheme: authorization.scheme,
      parameter: authorization.parameter,
    };
  }
}
