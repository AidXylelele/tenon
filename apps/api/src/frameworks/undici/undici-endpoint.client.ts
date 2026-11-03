import $RefParser from '@apidevtools/json-schema-ref-parser';
import { Injectable } from '@nestjs/common';
import {
  BulkheadFullError,
  type ExecuteOptions,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { request as send } from 'undici';
import type { JsonObject, JsonValue } from '../../domain/automation/json.js';
import { AuthorizationKind, EndpointOutcomeKind } from '../runtime/enums.js';
import {
  type Authorization,
  type ClientCredentials,
  type DocumentOutcome,
  type DocumentRequest,
  EndpointClient,
  type EndpointFailure,
  type Exchange,
  type ExchangeOutcome,
  type HttpRequest,
  type SentAuthorization,
} from '../runtime/interfaces.js';
import { EndpointDispatcher } from './endpoint-dispatcher.js';
import { ResponseTooLargeError, TokenRefusedError } from './endpoint.errors.js';

interface ReceivedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

@Injectable()
export class UndiciEndpointClient implements EndpointClient {
  private static readonly PRESET = 'service-calls';
  private static readonly DEADLINE = 'TimeoutError';
  private static readonly INVALID_ARGUMENT = 'UND_ERR_INVALID_ARG';
  private static readonly MAXIMUM_BYTES = 1024 * 1024;
  private static readonly DISCOVERY = '/.well-known/openid-configuration';
  private static readonly UNREACHABLE = 'The service could not be reached';
  private static readonly TOO_LARGE = 'The response is larger than 1 MiB';
  private static readonly TOKEN_REFUSED =
    'The authorization server refused the client credentials';

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly dispatcher: EndpointDispatcher,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(UndiciEndpointClient.PRESET);
  }

  async exchange(exchange: Exchange): Promise<ExchangeOutcome> {
    const options = UndiciEndpointClient.optionsOf(exchange.timeout);

    try {
      return await this.policy.execute(
        ({ signal }) => this.#exchange(exchange, signal),
        options,
      );
    } catch (error) {
      return UndiciEndpointClient.failureOf(error);
    }
  }

  async read(request: DocumentRequest): Promise<DocumentOutcome> {
    const options = UndiciEndpointClient.optionsOf(request.timeout);

    try {
      return await this.policy.execute(
        ({ signal }) => this.#read(request, signal),
        options,
      );
    } catch (error) {
      return UndiciEndpointClient.failureOf(error);
    }
  }

  async #exchange(
    exchange: Exchange,
    signal: AbortSignal,
  ): Promise<ExchangeOutcome> {
    const authorization = await this.#authorize(exchange.authorization, signal);
    const request = UndiciEndpointClient.authorized(
      exchange.request,
      authorization,
    );
    const response = await this.#send(request, signal);
    return {
      kind: EndpointOutcomeKind.Responded,
      status: response.status,
      headers: response.headers,
      body: response.body,
      authorization,
    };
  }

  async #read(
    request: DocumentRequest,
    signal: AbortSignal,
  ): Promise<DocumentOutcome> {
    const authorization = await this.#authorize(request.authorization, signal);
    const unsigned: HttpRequest = {
      method: 'GET',
      url: request.url,
      headers: {},
      body: null,
    };
    const signed = UndiciEndpointClient.authorized(unsigned, authorization);
    const response = await this.#send(signed, signal);

    if (response.status >= 300) return { kind: EndpointOutcomeKind.Unreadable };

    const text = response.body.toString('utf8');

    try {
      const dereferenced: unknown = await $RefParser.dereference(request.url, {
        resolve: {
          external: false,
          file: false,
          http: false,
          fetched: { order: 1, canRead: true, read: () => text },
        },
        dereference: { circular: 'ignore' },
      });
      const document = UndiciEndpointClient.objectOf(dereferenced as JsonValue);
      return { kind: EndpointOutcomeKind.Read, document };
    } catch {
      return { kind: EndpointOutcomeKind.Unreadable };
    }
  }

  async #authorize(
    authorization: Authorization | null,
    signal: AbortSignal,
  ): Promise<SentAuthorization | null> {
    if (authorization === null) return null;

    if (authorization.kind === AuthorizationKind.Header)
      return {
        scheme: authorization.scheme,
        parameter: authorization.parameter,
      };

    const endpoint = await this.#tokenEndpoint(authorization, signal);
    return this.#token(endpoint, authorization, signal);
  }

  async #tokenEndpoint(
    credentials: ClientCredentials,
    signal: AbortSignal,
  ): Promise<string> {
    if (credentials.tokenEndpoint !== null) return credentials.tokenEndpoint;

    const url = `${credentials.issuer ?? ''}${UndiciEndpointClient.DISCOVERY}`;
    const request: HttpRequest = {
      method: 'GET',
      url,
      headers: {},
      body: null,
    };
    const discovery = await this.#send(request, signal);
    const configuration = UndiciEndpointClient.jsonOf(discovery);
    const endpoint = configuration.token_endpoint;

    if (discovery.status >= 300 || typeof endpoint !== 'string')
      throw new TokenRefusedError(UndiciEndpointClient.TOKEN_REFUSED);

    return endpoint;
  }

  async #token(
    endpoint: string,
    credentials: ClientCredentials,
    signal: AbortSignal,
  ): Promise<SentAuthorization> {
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    const headers: Record<string, string> = {
      'content-type': 'application/x-www-form-urlencoded',
    };

    if (credentials.scopes.length > 0)
      form.set('scope', credentials.scopes.join(' '));

    for (const audience of credentials.audiences)
      form.append('audience', audience);

    if (credentials.secretInHeader) {
      const pair = `${credentials.clientId}:${credentials.clientSecret}`;
      const encoded = Buffer.from(pair, 'utf8').toString('base64');
      headers.authorization = `Basic ${encoded}`;
    } else {
      form.set('client_id', credentials.clientId);
      form.set('client_secret', credentials.clientSecret);
    }

    const body = form.toString();
    const request: HttpRequest = {
      method: 'POST',
      url: endpoint,
      headers,
      body,
    };
    const response = await this.#send(request, signal);
    const granted = UndiciEndpointClient.jsonOf(response);
    const token = granted.access_token;

    if (response.status >= 300 || typeof token !== 'string')
      throw new TokenRefusedError(UndiciEndpointClient.TOKEN_REFUSED);

    return { scheme: 'Bearer', parameter: token };
  }

  async #send(
    request: HttpRequest,
    signal: AbortSignal,
  ): Promise<ReceivedResponse> {
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

      if (size > UndiciEndpointClient.MAXIMUM_BYTES) {
        response.body.destroy();
        throw new ResponseTooLargeError(UndiciEndpointClient.TOO_LARGE);
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

  private static authorized(
    request: HttpRequest,
    authorization: SentAuthorization | null,
  ): HttpRequest {
    if (authorization === null) return request;

    const headers: Record<string, string> = {};

    for (const name of Object.keys(request.headers))
      headers[name] = request.headers[name] ?? '';

    headers.authorization = `${authorization.scheme} ${authorization.parameter}`;
    return {
      method: request.method,
      url: request.url,
      headers,
      body: request.body,
    };
  }

  // The task's deadline cancels the execution, within the preset's own timeout.
  private static optionsOf(timeout: number | null): ExecuteOptions {
    if (timeout === null) return {};

    return { signal: AbortSignal.timeout(timeout) };
  }

  private static failureOf(error: unknown): EndpointFailure {
    if (error instanceof BulkheadFullError)
      return { kind: EndpointOutcomeKind.Rejected };

    const deadlinePassed =
      error instanceof DOMException &&
      error.name === UndiciEndpointClient.DEADLINE;

    if (error instanceof ResilienceTimeoutError || deadlinePassed)
      return { kind: EndpointOutcomeKind.TimedOut };

    if (error instanceof TokenRefusedError)
      return { kind: EndpointOutcomeKind.Unauthorized, reason: error.message };

    if (error instanceof ResponseTooLargeError)
      return { kind: EndpointOutcomeKind.Unreachable, reason: error.message };

    const code: unknown =
      error instanceof Error ? Reflect.get(error, 'code') : undefined;

    if (
      code === UndiciEndpointClient.INVALID_ARGUMENT &&
      error instanceof Error
    )
      return { kind: EndpointOutcomeKind.Invalid, reason: error.message };

    const transport =
      error instanceof Error && typeof Reflect.get(error, 'code') === 'string';

    if (transport)
      return {
        kind: EndpointOutcomeKind.Unreachable,
        reason: UndiciEndpointClient.UNREACHABLE,
      };

    throw error;
  }

  private static jsonOf(response: ReceivedResponse): JsonObject {
    const text = response.body.toString('utf8');

    try {
      const parsed = JSON.parse(text) as JsonValue;
      return UndiciEndpointClient.objectOf(parsed);
    } catch {
      return {};
    }
  }

  private static objectOf(value: JsonValue): JsonObject {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value);

    if (!object) return {};

    return value;
  }
}
