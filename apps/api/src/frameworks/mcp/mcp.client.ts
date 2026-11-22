import { Injectable } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ErrorCode,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ListToolsResultSchema,
  McpError,
  ReadResourceResultSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ResilienceError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type { JsonObject, JsonValue, RpcOutcome } from "interpreter";
import { $ZodError } from "zod/v4/core";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import type { Authorization } from "../http-client/interfaces.js";
import { HttpClient } from "../http-client/http.client.js";
import { RELEASE_VERSION } from "../release.js";
import type { CallContext } from "../workflows/interfaces.js";
import type { HttpMcpRequest, McpMethod } from "./interfaces.js";

const RESULTS = {
  "tools/list": ListToolsResultSchema,
  "tools/call": CallToolResultSchema,
  "prompts/list": ListPromptsResultSchema,
  "prompts/get": GetPromptResultSchema,
  "resources/list": ListResourcesResultSchema,
  "resources/read": ReadResourceResultSchema,
  "resources/templates/list": ListResourceTemplatesResultSchema,
} as const satisfies Record<McpMethod, unknown>;

@Injectable()
export class McpClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly authentication: HttpAuthentication,
    private readonly http: HttpClient,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("mcp-calls");
  }

  async call(
    request: HttpMcpRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(request.protocolVersion))
      return {
        kind: "misconfigured",
        detail:
          "The host does not speak this version of the Model Context Protocol",
      };

    const parameters = request.parameters;

    if (parameters !== null && !this.#isObject(parameters))
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
      return this.#failureOf(error, context.signal);
    }
  }

  async #answered(
    request: HttpMcpRequest,
    parameters: JsonObject | null,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<RpcOutcome> {
    const authorization = await this.authentication.authorizationOf(
      request.transport.endpoint.authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const transport = this.#transportOf(request, authorization, signal);
    const identity = request.client ?? {
      name: "tenon",
      version: RELEASE_VERSION,
    };
    const client = new Client(identity, { capabilities: {} });

    try {
      await client.connect(transport, { signal });
      const result = await client.request(
        { method: request.method, params: parameters ?? undefined },
        RESULTS[request.method],
        { signal },
      );
      await Promise.allSettled([transport.terminateSession()]);
      return { kind: "answered", result: this.#jsonOf(result) };
    } finally {
      await client.close();
    }
  }

  #transportOf(
    request: HttpMcpRequest,
    authorization: Authorization,
    signal: AbortSignal,
  ): StreamableHTTPClientTransport {
    const endpoint = new URL(request.transport.endpoint.uri);
    return new StreamableHTTPClientTransport(endpoint, {
      fetch: this.http.fetchFor(authorization, signal),
      requestInit: { headers: request.transport.headers, redirect: "manual" },
      reconnectionOptions: {
        initialReconnectionDelay: 0,
        maxReconnectionDelay: 0,
        reconnectionDelayGrowFactor: 1,
        maxRetries: 0,
      },
    });
  }

  #failureOf(error: unknown, signal: AbortSignal): RpcOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    if (error instanceof McpError) return this.#rpcFailureOf(error);

    if (error instanceof StreamableHTTPError) return this.#httpFailureOf(error);

    if (error instanceof $ZodError || error instanceof SyntaxError)
      return {
        kind: "unreachable",
        detail: "The MCP server answered other than the protocol describes",
      };

    const failure = this.http.transportFailureOf(error);

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
    const message = error.message.startsWith(prefix)
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
    const text = JSON.stringify(value ?? null);
    return JSON.parse(text) as JsonValue;
  }

  #isObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
