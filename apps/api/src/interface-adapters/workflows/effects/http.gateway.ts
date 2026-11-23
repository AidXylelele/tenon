import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { Authentication, HttpOutcome, HttpRequest } from "interpreter";
import { Authenticator } from "./authenticator.js";
import {
  type Authorization,
  type CallContext,
  type EndpointFetch,
  HttpConnection,
  type OutboundRequest,
  type ResponseOptions,
  type Signed,
} from "./interfaces.js";
import { ResponseContent } from "./response-content.js";
import { TransportFailures } from "./transport-failures.js";

@Injectable()
export class HttpGateway {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly connection: HttpConnection,
    private readonly authenticator: Authenticator,
    private readonly content: ResponseContent,
    private readonly failures: TransportFailures,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  async perform(
    request: HttpRequest,
    context: CallContext,
  ): Promise<HttpOutcome> {
    try {
      return await this.policy.execute(
        (attempt) => this.#sent(request, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.failures.of(error, context.signal);
    }
  }

  async exchange(
    outbound: OutboundRequest,
    authentication: Authentication | null,
    options: ResponseOptions,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const authorization = await this.authenticator.authorizationOf(
      authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const keyed = this.#keyed(outbound, context.idempotencyKey);
    const signed = await this.#signed(keyed, authorization, signal);
    return this.content.respondedOf(keyed, signed, options);
  }

  fetchFor(authorization: Authorization, signal: AbortSignal): EndpointFetch {
    return (url, init) => this.#fetchedFor(authorization, url, init, signal);
  }

  #sent(
    request: HttpRequest,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<HttpOutcome> {
    const outbound = this.#outboundOf(request);
    const authentication = request.endpoint.authentication;
    return this.exchange(outbound, authentication, request, context, signal);
  }

  async #signed(
    request: OutboundRequest,
    authorization: Authorization,
    signal: AbortSignal,
  ): Promise<Signed> {
    const fetch = this.fetchFor(authorization, signal);
    const response = await fetch(request.uri, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const revealed =
      authorization.kind === "header" ? authorization.header : null;
    return { response, authorization: revealed };
  }

  #fetchedFor(
    authorization: Authorization,
    url: string | URL,
    init: RequestInit | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    const signals = init?.signal ? [signal, init.signal] : [signal];
    const scoped = AbortSignal.any(signals);

    if (authorization.kind === "header") {
      const value = this.authenticator.headerValueOf(authorization.header);
      headers.set("authorization", value);
    }

    return this.connection.fetch(url, {
      method: init?.method,
      headers,
      body: init?.body,
      redirect: init?.redirect,
      signal: scoped,
    });
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

  #keyed(request: OutboundRequest, idempotencyKey: string): OutboundRequest {
    const carried = request.headers.has("idempotency-key");

    if (carried) return request;

    const headers = new Headers(request.headers);
    headers.set("idempotency-key", idempotencyKey);
    return {
      method: request.method,
      uri: request.uri,
      headers,
      body: request.body,
    };
  }
}
