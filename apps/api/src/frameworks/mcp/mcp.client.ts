import { Injectable } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
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
import { Authenticator } from "../../interface-adapters/workflows/effects/authenticator.js";
import type {
  Authorization,
  CallContext,
} from "../../interface-adapters/workflows/effects/interfaces.js";
import { TransportFailures } from "../../interface-adapters/workflows/effects/transport-failures.js";
import { PermanentFault } from "../../interface-adapters/workflows/permanent-fault.error.js";
import { HttpClient } from "../http-client/http.client.js";
import { RELEASE_VERSION } from "../release.js";
import type { HttpMcpRequest, McpMethod } from "./interfaces.js";

@Injectable()
export class McpClient {
  private static readonly RESULTS = {
    "tools/list": ListToolsResultSchema,
    "tools/call": CallToolResultSchema,
    "prompts/list": ListPromptsResultSchema,
    "prompts/get": GetPromptResultSchema,
    "resources/list": ListResourcesResultSchema,
    "resources/read": ReadResourceResultSchema,
    "resources/templates/list": ListResourceTemplatesResultSchema,
  } as const satisfies Record<McpMethod, unknown>;
  private static readonly SESSION_HEADERS: readonly string[] = [
    "mcp-session-id",
    "mcp-protocol-version",
  ];
  private static readonly CLEANUP_TIMEOUT = 2_000;

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly authentication: Authenticator,
    private readonly http: HttpClient,
    private readonly failures: TransportFailures,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("mcp-calls");
  }

  async call(
    request: HttpMcpRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const spoken = SUPPORTED_PROTOCOL_VERSIONS.includes(
      request.protocolVersion,
    );

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
    const client = this.#clientOf(request);
    const options = this.#optionsOf(context.remaining, signal);

    try {
      await client.connect(transport, options);
      const negotiated = transport.protocolVersion ?? "";

      if (negotiated < request.protocolVersion)
        return {
          kind: "misconfigured",
          detail: `The MCP server speaks a version of the protocol older than ${request.protocolVersion}`,
        };

      const params = parameters ?? undefined;
      const result = await client.request(
        { method: request.method, params },
        McpClient.RESULTS[request.method],
        options,
      );
      const answer = this.#jsonOf(result);
      return { kind: "answered", result: answer };
    } finally {
      await client.close();
      await this.#terminated(transport, request, authorization);
    }
  }

  #transportOf(
    request: HttpMcpRequest,
    authorization: Authorization,
    signal: AbortSignal,
    sessionId?: string,
  ): StreamableHTTPClientTransport {
    const endpoint = new URL(request.transport.endpoint.uri);
    const fetch = this.http.fetchFor(authorization, signal);
    const headers = this.#workflowHeadersOf(request.transport.headers);
    return new StreamableHTTPClientTransport(endpoint, {
      fetch,
      requestInit: { headers },
      reconnectionOptions: {
        initialReconnectionDelay: 0,
        maxReconnectionDelay: 0,
        reconnectionDelayGrowFactor: 1,
        maxRetries: 0,
      },
      sessionId,
    });
  }

  #workflowHeadersOf(
    headers: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const kept = Object.entries(headers).filter(([name]) => {
      const lowered = name.toLowerCase();
      const session = McpClient.SESSION_HEADERS.includes(lowered);
      return !session;
    });
    return Object.fromEntries(kept);
  }

  #clientOf(request: HttpMcpRequest): Client {
    const identity = request.client ?? {
      name: "tenon",
      version: RELEASE_VERSION,
    };
    return new Client(identity, { capabilities: {} });
  }

  #optionsOf(remaining: number | null, signal: AbortSignal): RequestOptions {
    if (remaining === null) return { signal };

    return { signal, timeout: remaining };
  }

  async #terminated(
    session: StreamableHTTPClientTransport,
    request: HttpMcpRequest,
    authorization: Authorization,
  ): Promise<void> {
    const sessionId = session.sessionId;
    const version = session.protocolVersion;

    if (sessionId === undefined || version === undefined) return;

    const cleanup = AbortSignal.timeout(McpClient.CLEANUP_TIMEOUT);
    const ending = this.#transportOf(
      request,
      authorization,
      cleanup,
      sessionId,
    );
    ending.setProtocolVersion(version);
    await ending.terminateSession().catch(() => undefined);
  }

  #failureOf(error: unknown, signal: AbortSignal): RpcOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    if (error instanceof PermanentFault) throw error;

    if (error instanceof McpError) return this.#rpcFailureOf(error);

    if (error instanceof StreamableHTTPError) return this.#httpFailureOf(error);

    if (error instanceof $ZodError || error instanceof SyntaxError)
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
}
