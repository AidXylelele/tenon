import { Injectable } from "@nestjs/common";
import {
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type {
  Authentication,
  HttpOutcome,
  HttpRequest,
  OpenApiRequest,
  Resource,
  ResourceOutcome,
  ResourceRequest,
  RevealedAuthorization,
} from "interpreter";
import { Authenticator } from "../../interface-adapters/workflows/effects/authenticator.js";
import type {
  Authorization,
  CallContext,
  EndpointFetch,
} from "../../interface-adapters/workflows/effects/interfaces.js";
import { TransportFailures } from "../../interface-adapters/workflows/effects/transport-failures.js";
import type {
  FetchedText,
  StepCall,
} from "../../interface-adapters/workflows/interfaces.js";
import { HttpClientName } from "../network/enums.js";
import type { OutboundRequest, ResponseOptions, Signed } from "./interfaces.js";
import { OpenApiOperations } from "./openapi-operations.js";
import { ResponseContent } from "./response-content.js";

@Injectable()
export class HttpClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
    private readonly authentication: Authenticator,
    private readonly operations: OpenApiOperations,
    private readonly failures: TransportFailures,
    private readonly content: ResponseContent,
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
      return this.failures.of(error, context.signal);
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
      return this.failures.of(error, context.signal);
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
      return this.failures.of(error, context.signal);
    }
  }

  async text(resource: Resource, step: StepCall): Promise<FetchedText> {
    try {
      return await this.policy.execute(
        (attempt) => this.#textFetched(resource, step, attempt.signal),
        { signal: step.signal },
      );
    } catch (error) {
      return this.failures.of(error, step.signal);
    }
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

    const document = this.content.documentOf(fetched.text);
    return { kind: "fetched", document };
  }

  async #textFetched(
    resource: Resource,
    step: StepCall,
    signal: AbortSignal,
  ): Promise<FetchedText> {
    const endpoint = resource.endpoint;
    const authorization = await this.authentication.authorizationOf(
      endpoint.authentication,
      step.secrets,
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

    const text = await this.content.textOf(response);
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
    return this.content.respondedOf(keyed, signed, options);
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
    const value = this.authentication.headerValueOf(authorization);
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
    const carried = request.headers.has("idempotency-key");

    if (carried) return request;

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
}
