import { Injectable } from "@nestjs/common";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type {
  JsonObject,
  JsonValue,
  McpRequest,
  RpcOutcome,
} from "interpreter";
import { $ZodError } from "zod/v4/core";
import { Authenticator } from "./authenticator.js";
import { HttpGateway } from "./http.gateway.js";
import {
  type CallContext,
  type HttpMcpRequest,
  type McpCall,
  McpConnection,
  type McpSession,
} from "./interfaces.js";
import { TransportFailures } from "./transport-failures.js";

@Injectable()
export class McpGateway {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly connection: McpConnection,
    private readonly authenticator: Authenticator,
    private readonly http: HttpGateway,
    private readonly failures: TransportFailures,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("mcp-calls");
  }

  async perform(
    request: McpRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const overHttp = this.#overHttp(request);

    if (!overHttp)
      throw new Error(
        "The host does not perform 'mcp.stdio'; its profile refuses it at publish",
      );

    const spoken = this.connection.speaks(request.protocolVersion);

    if (!spoken)
      return {
        kind: "misconfigured",
        detail:
          "The host does not speak this version of the Model Context Protocol",
      };

    const parameters = request.parameters;
    const unfit = parameters !== null && !this.#isObject(parameters);

    if (unfit)
      return {
        kind: "misconfigured",
        detail: "The parameters of an MCP method are an object",
      };

    try {
      return await this.policy.execute(
        (attempt) =>
          this.#answered(request, parameters, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.failures.of(error, context.signal);
    }
  }

  async #answered(
    request: HttpMcpRequest,
    params: JsonObject | null,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<RpcOutcome> {
    const transport = request.transport;
    const authorization = await this.authenticator.authorizationOf(
      transport.endpoint.authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const session: McpSession = {
      endpoint: transport.endpoint.uri,
      headers: transport.headers,
      client: request.client,
      protocolVersion: request.protocolVersion,
      fetchOf: (scope) => this.http.fetchFor(authorization, scope),
    };
    const call = {
      method: request.method,
      params,
      remaining: context.remaining,
    };

    try {
      return await this.#sessionAnswered(request, session, call, signal);
    } catch (error) {
      return this.#sessionFailureOf(error, signal);
    }
  }

  async #sessionAnswered(
    request: HttpMcpRequest,
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<RpcOutcome> {
    const answer = await this.connection.request(session, call, signal);

    if (answer.kind === "outdated")
      return {
        kind: "misconfigured",
        detail: `The MCP server speaks a version of the protocol older than ${request.protocolVersion}`,
      };

    const result = this.#jsonOf(answer.result);
    return { kind: "answered", result };
  }

  #sessionFailureOf(error: unknown, signal: AbortSignal): RpcOutcome {
    if (signal.aborted) throw error;

    if (error instanceof McpError) return this.#rpcFailureOf(error);

    if (error instanceof StreamableHTTPError) return this.#httpFailureOf(error);

    const unspoken = error instanceof $ZodError || error instanceof SyntaxError;

    if (unspoken)
      return {
        kind: "unreachable",
        detail: "The MCP server answered other than the protocol describes",
      };

    const failure = this.failures.classified(error);

    if (failure !== null) return failure;

    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "unreachable", detail: `The MCP session failed: ${reason}` };
  }

  #rpcFailureOf(error: McpError): RpcOutcome {
    const closed: number = ErrorCode.ConnectionClosed;

    if (error.code === closed)
      return {
        kind: "unreachable",
        detail: "The MCP server closed the connection before it answered",
      };

    const prefix = `MCP error ${String(error.code)}: `;
    const prefixed = error.message.startsWith(prefix);
    const message = prefixed
      ? error.message.slice(prefix.length)
      : error.message;
    const data = this.#jsonOf(error.data);
    return { kind: "rpcError", code: error.code, message, data };
  }

  #httpFailureOf(error: StreamableHTTPError): RpcOutcome {
    const status = error.code;
    const answered =
      typeof status === "number" && status >= 100 && status <= 599;

    if (!answered)
      return {
        kind: "unreachable",
        detail: "The MCP server answered other than the protocol describes",
      };

    return {
      kind: "rejected",
      statusCode: status,
      detail: `The MCP server answered with status ${String(status)}`,
    };
  }

  #jsonOf(value: unknown): JsonValue {
    const defined = value ?? null;
    const text = JSON.stringify(defined);
    return JSON.parse(text) as JsonValue;
  }

  #isObject(value: JsonValue): value is JsonObject {
    const list = Array.isArray(value);
    return typeof value === "object" && value !== null && !list;
  }

  #overHttp(request: McpRequest): request is HttpMcpRequest {
    return request.transport.kind === "http";
  }
}
