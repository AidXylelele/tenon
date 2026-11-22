import { isUtf8 } from "node:buffer";
import { randomUUID } from "node:crypto";
import { MIMEType } from "node:util";
import { Injectable } from "@nestjs/common";
import {
  HttpNetworkError,
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import {
  ResilienceError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type {
  Authentication,
  Failure,
  HttpOutcome,
  HttpRequest,
  JsonValue,
  OpenApiRequest,
  Resource,
  ResourceOutcome,
  ResourceRequest,
  RespondedHttpOutcome,
  RevealedAuthorization,
} from "interpreter";
import { ImportRefusal } from "../../application/automation/imports/enums.js";
import type {
  ImportFailure,
  ImportResult,
} from "../../application/automation/imports/interfaces.js";
import type { ImportFetcher } from "../../application/automation/imports/ports.js";
import type { CallContext } from "../interpreter/interfaces.js";
import { AddressPolicy } from "./address-policy.js";
import { AuthorizationServer } from "./authorization-server.js";
import { HttpClientName } from "./enums.js";
import { HttpAuthentication } from "./http-authentication.js";
import type {
  Authorization,
  EndpointFetch,
  FetchedText,
  OutboundRequest,
  ResponseOptions,
  Signed,
} from "./interfaces.js";
import { OpenApiOperations } from "./openapi-operations.js";
import { ResponseSizeLimit } from "./response-size-limit.js";

const INVALID_REQUEST =
  "The request cannot be sent: its URI, method, headers or body are not valid";

const CERTIFICATE_REFUSED = "The service's TLS certificate was refused";

const CLOSED_EARLY = "The connection closed before the service answered";

const UNRESOLVED = "The host name could not be resolved";

const UNREACHABLE = "The service could not be reached";

const NETWORK_REASONS = new Map<string, string>([
  ["ENOTFOUND", UNRESOLVED],
  ["EAI_AGAIN", UNRESOLVED],
  ["ECONNREFUSED", "The service refused the connection"],
  ["ECONNRESET", CLOSED_EARLY],
  ["EPIPE", CLOSED_EARLY],
  ["UND_ERR_SOCKET", CLOSED_EARLY],
  ["UND_ERR_CLOSED", CLOSED_EARLY],
  ["UND_ERR_RES_EXCEEDED_MAX_SIZE", "The response is larger than 1 MiB"],
  ["ETIMEDOUT", "The connection timed out"],
  ["UND_ERR_CONNECT_TIMEOUT", "The connection timed out"],
  ["EHOSTUNREACH", "The host is unreachable"],
  ["ENETUNREACH", "The network is unreachable"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", CERTIFICATE_REFUSED],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", CERTIFICATE_REFUSED],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", CERTIFICATE_REFUSED],
  ["SELF_SIGNED_CERT_IN_CHAIN", CERTIFICATE_REFUSED],
  ["ERR_TLS_CERT_ALTNAME_INVALID", CERTIFICATE_REFUSED],
]);

const IMPORT_EXPIRED =
  "The import's server did not answer within the time limit";

const CREDENTIAL_HEADERS: readonly string[] = [
  "authorization",
  "proxy-authorization",
];

const TEXT_APPLICATIONS: readonly string[] = [
  "xml",
  "javascript",
  "x-www-form-urlencoded",
];

@Injectable()
export class HttpClient implements ImportFetcher {
  static readonly RESPONSE_BYTES = 1024 * 1024;

  private readonly policy: ResiliencePolicy;

  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
    private readonly authentication: HttpAuthentication,
    private readonly operations: OpenApiOperations,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  async send(request: HttpRequest, context: CallContext): Promise<HttpOutcome> {
    try {
      return await this.policy.execute(
        (attempt) => this.exchange(request, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  async call(
    request: OpenApiRequest,
    context: CallContext,
  ): Promise<HttpOutcome> {
    try {
      return await this.policy.execute(
        (attempt) => this.#operationCalled(request, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  async read(
    request: ResourceRequest,
    context: CallContext,
  ): Promise<ResourceOutcome> {
    try {
      return await this.policy.execute(
        (attempt) =>
          this.#documentRead(request.resource, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  async text(resource: Resource, context: CallContext): Promise<FetchedText> {
    try {
      return await this.policy.execute(
        (attempt) => this.#textFetched(resource, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  async fetch(uri: string): Promise<ImportResult> {
    const endpoint = { uri, authentication: null };
    const resource = { name: null, endpoint };
    const signal = new AbortController().signal;
    const idempotencyKey = randomUUID();
    const context = { idempotencyKey, signal, secrets: {}, remaining: null };
    const fetched = await this.text(resource, context);

    if (fetched.kind === "text")
      return { ok: true, value: { text: fetched.text } };

    const failure = this.#importFailureOf(fetched);
    return { ok: false, failure };
  }

  exchange(
    request: HttpRequest,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const outbound = this.#outboundOf(request);
    const authentication = request.endpoint.authentication;
    return this.#responded(outbound, authentication, request, context, signal);
  }

  fetchFor(authorization: Authorization, signal: AbortSignal): EndpointFetch {
    return (url, init) => this.#fetchedFor(authorization, url, init, signal);
  }

  transportFailureOf(error: unknown): Failure | null {
    const cause = this.#causeOf(error);

    if (cause instanceof TypeError)
      return { kind: "misconfigured", detail: INVALID_REQUEST };

    const code: unknown =
      cause instanceof Error ? Reflect.get(cause, "code") : undefined;
    const detail = cause instanceof Error ? cause.message : "";

    switch (code) {
      case AuthorizationServer.REFUSED:
        return { kind: "unauthenticated", detail };
      case AddressPolicy.REFUSED:
      case ResponseSizeLimit.EXCEEDED:
        return { kind: "unreachable", detail };
    }

    if (typeof code === "string") return this.#networkFailureOf(code);

    if (error instanceof HttpNetworkError)
      return { kind: "unreachable", detail: UNREACHABLE };

    return null;
  }

  async #operationCalled(
    request: OpenApiRequest,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const document = await this.#textFetched(request.document, context, signal);

    if (document.kind !== "text") return document;

    const operation = await this.operations.requestOf(
      document.text,
      request.document.endpoint.uri,
      request.operationId,
      request.parameters,
    );

    if (operation.kind === "misconfigured") return operation;

    const authentication = request.authentication;
    return this.#responded(
      operation.request,
      authentication,
      request,
      context,
      signal,
    );
  }

  async #documentRead(
    resource: Resource,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<ResourceOutcome> {
    const fetched = await this.#textFetched(resource, context, signal);

    if (fetched.kind !== "text") return fetched;

    const document = this.#documentOf(fetched.text);
    return { kind: "fetched", document };
  }

  async #textFetched(
    resource: Resource,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<FetchedText> {
    const endpoint = resource.endpoint;
    const authorization = await this.authentication.authorizationOf(
      endpoint.authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const request: OutboundRequest = {
      method: "GET",
      uri: endpoint.uri,
      headers: new Headers(),
      body: null,
      redirect: "manual",
    };
    const signed = await this.#signed(request, authorization, signal);
    const response = signed.response;

    if (!response.ok) {
      await response.body?.cancel();
      const status = String(response.status);
      return {
        kind: "rejected",
        statusCode: response.status,
        detail: `The server answered the resource with status ${status}`,
      };
    }

    const body = await this.#bodyOf(response);
    const media = this.#mediaOf(response);
    const text = this.#textOf(body, media);
    return { kind: "text", text };
  }

  async #responded(
    outbound: OutboundRequest,
    authentication: Authentication | null,
    options: ResponseOptions,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const authorization = await this.authentication.authorizationOf(
      authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const keyed = this.#keyed(outbound, context.idempotencyKey);
    const signed = await this.#signed(keyed, authorization, signal);
    return this.#respondedOf(keyed, signed, options);
  }

  async #respondedOf(
    request: OutboundRequest,
    signed: Signed,
    options: ResponseOptions,
  ): Promise<RespondedHttpOutcome> {
    const response = signed.response;
    const body = await this.#bodyOf(response);
    const content = this.#contentOf(body, response, options.output);
    const headers = this.#headersOf(response);
    const authorization = options.revealAuthorization
      ? signed.authorization
      : null;
    const shown = this.#withoutCredentials(request.headers);
    const sent = { method: request.method, uri: request.uri, headers: shown };
    return {
      kind: "responded",
      request: sent,
      statusCode: response.status,
      headers,
      content,
      authorization,
    };
  }

  #signed(
    request: OutboundRequest,
    authorization: Authorization,
    signal: AbortSignal,
  ): Promise<Signed> {
    switch (authorization.kind) {
      case "anonymous":
        return this.#unsigned(request, signal);
      case "header":
        return this.#signedWith(request, authorization.header, signal);
    }
  }

  async #unsigned(
    request: OutboundRequest,
    signal: AbortSignal,
  ): Promise<Signed> {
    const response = await this.#sent(request, signal);
    return { response, authorization: null };
  }

  async #signedWith(
    request: OutboundRequest,
    authorization: RevealedAuthorization,
    signal: AbortSignal,
  ): Promise<Signed> {
    const value = `${authorization.scheme} ${authorization.parameter}`;
    const signed = this.#withHeader(request, "authorization", value);
    const response = await this.#sent(signed, signal);
    return { response, authorization };
  }

  async #sent(
    request: OutboundRequest,
    signal: AbortSignal,
  ): Promise<Response> {
    const sent = await this.outbound.request(request.uri, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.redirect,
      signal,
      responseType: "response",
    });
    return sent.data;
  }

  async #fetchedFor(
    authorization: Authorization,
    url: string | URL,
    init: RequestInit | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    const request: OutboundRequest = {
      method: init?.method ?? "GET",
      uri: url.toString(),
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
      redirect: init?.redirect ?? "manual",
    };
    const signals = init?.signal ? [signal, init.signal] : [signal];
    const scoped = AbortSignal.any(signals);
    const signed = await this.#signed(request, authorization, scoped);
    return signed.response;
  }

  #importFailureOf(failure: Failure): ImportFailure {
    switch (failure.kind) {
      case "expired":
        return { refusal: ImportRefusal.Expired, detail: IMPORT_EXPIRED };
      case "unreachable":
        return { refusal: ImportRefusal.Unreachable, detail: failure.detail };
      case "rejected":
        return { refusal: ImportRefusal.Rejected, detail: failure.detail };
      case "unauthenticated":
        return {
          refusal: ImportRefusal.Unauthenticated,
          detail: failure.detail,
        };
      case "forbidden":
      case "misconfigured":
        return { refusal: ImportRefusal.Misconfigured, detail: failure.detail };
    }
  }

  #failureOf(error: unknown, signal: AbortSignal): Failure {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    const failure = this.transportFailureOf(error);

    if (failure === null) throw error;

    return failure;
  }

  #causeOf(error: unknown): unknown {
    if (error instanceof HttpNetworkError) return error.cause;

    const wrapped = error instanceof TypeError && error.cause !== undefined;
    return wrapped ? error.cause : error;
  }

  #networkFailureOf(code: string): Failure {
    const invalid = [
      "UND_ERR_INVALID_ARG",
      "UND_ERR_NOT_SUPPORTED",
      "ERR_INVALID_URL",
      "ERR_INVALID_HTTP_TOKEN",
      "ERR_INVALID_CHAR",
    ].includes(code);

    if (invalid) return { kind: "misconfigured", detail: INVALID_REQUEST };

    if (code.startsWith("CERT_"))
      return { kind: "unreachable", detail: CERTIFICATE_REFUSED };

    const detail = NETWORK_REASONS.get(code) ?? UNREACHABLE;
    return { kind: "unreachable", detail };
  }

  #outboundOf(request: HttpRequest): OutboundRequest {
    const declared = request.body;
    const structured = declared !== null && typeof declared !== "string";
    const body = structured ? JSON.stringify(declared) : declared;
    const headers = new Headers(request.headers);
    const untyped = structured && !headers.has("content-type");

    if (untyped) headers.set("content-type", "application/json");

    return {
      method: request.method,
      uri: request.endpoint.uri,
      headers,
      body,
      redirect: "manual",
    };
  }

  #keyed(request: OutboundRequest, idempotencyKey: string): OutboundRequest {
    if (request.headers.has("idempotency-key")) return request;

    return this.#withHeader(request, "idempotency-key", idempotencyKey);
  }

  #withHeader(
    request: OutboundRequest,
    name: string,
    value: string,
  ): OutboundRequest {
    const headers = new Headers(request.headers);
    headers.set(name, value);
    return {
      method: request.method,
      uri: request.uri,
      headers,
      body: request.body,
      redirect: request.redirect,
    };
  }

  #withoutCredentials(headers: Headers): Readonly<Record<string, string>> {
    const shown = new Headers(headers);

    for (const name of CREDENTIAL_HEADERS) shown.delete(name);

    return Object.fromEntries(shown);
  }

  #headersOf(response: Response): Readonly<Record<string, string>> {
    const headers = new Map(response.headers);
    const cookies = response.headers.getSetCookie().join(", ");

    if (cookies !== "") headers.set("set-cookie", cookies);

    return Object.fromEntries(headers);
  }

  async #bodyOf(response: Response): Promise<Buffer> {
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }

  #contentOf(
    body: Buffer,
    response: Response,
    output: HttpRequest["output"],
  ): JsonValue {
    if (body.length === 0) return null;

    if (output === "raw") return body.toString("base64");

    const media = this.#mediaOf(response);

    if (this.#readsAsJson(media, body)) {
      const text = this.#textOf(body, media);
      return this.#documentOf(text);
    }

    if (this.#readsAsText(media)) return this.#textOf(body, media);

    return body.toString("base64");
  }

  #mediaOf(response: Response): MIMEType | null {
    const contentType = response.headers.get("content-type");

    if (contentType === null) return null;

    try {
      return new MIMEType(contentType);
    } catch {
      return null;
    }
  }

  #readsAsJson(media: MIMEType | null, body: Buffer): boolean {
    if (media === null) return isUtf8(body);

    if (media.type !== "application") return false;

    return media.subtype === "json" || media.subtype.endsWith("+json");
  }

  #readsAsText(media: MIMEType | null): boolean {
    if (media === null) return false;

    if (media.type === "text") return true;

    if (media.type !== "application") return false;

    return (
      TEXT_APPLICATIONS.includes(media.subtype) ||
      media.subtype.endsWith("+xml")
    );
  }

  #textOf(body: Buffer, media: MIMEType | null): string {
    const charset = media?.params.get("charset") ?? "utf-8";

    try {
      return new TextDecoder(charset).decode(body);
    } catch {
      return new TextDecoder("utf-8").decode(body);
    }
  }

  #documentOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }
}
