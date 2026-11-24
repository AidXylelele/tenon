import { Injectable } from "@nestjs/common";
import type { Authentication, HttpOutcome, HttpRequest } from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import type { Authorization } from "../auth/interfaces.js";
import type { CallContext } from "../workflows/effects/interfaces.js";
import { BodyReading } from "./enums.js";
import {
  HttpClient,
  type OutboundRequest,
  type ResponseOptions,
} from "./interfaces.js";
import { TransportFault } from "./transport-fault.error.js";

@Injectable()
export class HttpCallGateway {
  private static readonly CREDENTIAL_HEADERS: readonly string[] = [
    "authorization",
    "proxy-authorization",
  ];

  constructor(
    private readonly client: HttpClient,
    private readonly authenticator: Authenticator,
  ) {}

  perform(request: HttpRequest, context: CallContext): Promise<HttpOutcome> {
    const outbound = this.#outboundOf(request);
    const authentication = request.endpoint.authentication;
    return this.exchange(outbound, authentication, request, context);
  }

  async exchange(
    outbound: OutboundRequest,
    authentication: Authentication | null,
    options: ResponseOptions,
    context: CallContext,
  ): Promise<HttpOutcome> {
    try {
      return await this.#exchanged(outbound, authentication, options, context);
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async #exchanged(
    outbound: OutboundRequest,
    authentication: Authentication | null,
    options: ResponseOptions,
    context: CallContext,
  ): Promise<HttpOutcome> {
    const authorization = await this.authenticator.authorizationOf(
      authentication,
      context.secrets,
      context.signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const sent = this.#sentOf(outbound, context.idempotencyKey, authorization);
    const reading =
      options.output === "raw" ? BodyReading.Raw : BodyReading.ByMediaType;
    const reply = await this.client.exchange(sent, reading, context.signal);
    const revealed =
      options.revealAuthorization && authorization.kind === "header"
        ? authorization.header
        : null;
    const shown = this.#withoutCredentials(sent.headers);
    return {
      kind: "responded",
      request: { method: sent.method, uri: sent.uri, headers: shown },
      statusCode: reply.statusCode,
      headers: reply.headers,
      content: reply.content,
      authorization: revealed,
    };
  }

  #outboundOf(request: HttpRequest): OutboundRequest {
    const declared = request.body;
    const structured = declared !== null && typeof declared !== "string";
    const body = structured ? JSON.stringify(declared) : declared;
    const headers = new Headers(request.headers);
    const untyped = structured && !headers.has("content-type");

    if (untyped) headers.set("content-type", "application/json");

    return { method: request.method, uri: request.endpoint.uri, headers, body };
  }

  #sentOf(
    request: OutboundRequest,
    idempotencyKey: string,
    authorization: Authorization,
  ): OutboundRequest {
    const headers = new Headers(request.headers);
    const carried = headers.has("idempotency-key");

    if (!carried) headers.set("idempotency-key", idempotencyKey);

    if (authorization.kind === "header") {
      const value = this.authenticator.headerValueOf(authorization.header);
      headers.set("authorization", value);
    }

    return {
      method: request.method,
      uri: request.uri,
      headers,
      body: request.body,
    };
  }

  #withoutCredentials(headers: Headers): Readonly<Record<string, string>> {
    const shown = new Headers(headers);

    for (const name of HttpCallGateway.CREDENTIAL_HEADERS) shown.delete(name);

    return Object.fromEntries(shown);
  }
}
