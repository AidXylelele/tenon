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
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { JsonValue } from "interpreter";
import { $ZodError } from "zod/v4/core";
import { TransportFailure } from "../../interface-adapters/http/enums.js";
import { TransportFault } from "../../interface-adapters/http/transport-fault.error.js";
import type {
  McpAnswer,
  McpCall,
  McpClient,
  McpMethod,
  McpSession,
} from "../../interface-adapters/mcp/interfaces.js";
import { UndiciHttpClient } from "../http/undici.http-client.js";
import { TransportFaults } from "../http/transport-faults.js";
import { RELEASE_VERSION } from "../release.js";

@Injectable()
export class StreamableHttpMcpClient implements McpClient {
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
  private static readonly UNSPOKEN =
    "The MCP server answered other than the protocol describes";

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly http: UndiciHttpClient,
    private readonly faults: TransportFaults,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("mcp-calls");
  }

  speaks(protocolVersion: string): boolean {
    return SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion);
  }

  async request(
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<McpAnswer> {
    try {
      return await this.policy.execute(
        (attempt) => this.#requested(session, call, attempt.signal),
        { signal },
      );
    } catch (error) {
      throw this.faults.of(error, signal);
    }
  }

  async #requested(
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<McpAnswer> {
    try {
      return await this.#answered(session, call, signal);
    } catch (error) {
      return this.#answerOf(error, signal);
    }
  }

  async #answered(
    session: McpSession,
    call: McpCall,
    signal: AbortSignal,
  ): Promise<McpAnswer> {
    const transport = this.#transportOf(session, signal);
    const client = this.#clientOf(session);
    const options = this.#optionsOf(call.remaining, signal);

    try {
      await client.connect(transport, options);
      const negotiated = transport.protocolVersion ?? "";
      const outdated = negotiated < session.protocolVersion;

      if (outdated) return { kind: "outdated" };

      const params = call.params ?? undefined;
      const answered = await client.request(
        { method: call.method, params },
        StreamableHttpMcpClient.RESULTS[call.method],
        options,
      );
      const result = this.#jsonOf(answered);
      return { kind: "answered", result };
    } finally {
      await client.close();
      await this.#terminated(transport, session);
    }
  }

  #answerOf(error: unknown, signal: AbortSignal): McpAnswer {
    if (signal.aborted) throw error;

    if (error instanceof McpError) return this.#rpcAnswerOf(error);

    if (error instanceof StreamableHTTPError) return this.#httpAnswerOf(error);

    const unspoken = error instanceof $ZodError || error instanceof SyntaxError;

    if (unspoken) throw this.#unreachable(StreamableHttpMcpClient.UNSPOKEN);

    const fault = this.faults.classified(error);

    if (fault !== null) throw fault;

    const reason = error instanceof Error ? error.message : String(error);
    throw this.#unreachable(`The MCP session failed: ${reason}`);
  }

  #rpcAnswerOf(error: McpError): McpAnswer {
    const closed: number = ErrorCode.ConnectionClosed;

    if (error.code === closed)
      throw this.#unreachable(
        "The MCP server closed the connection before it answered",
      );

    const prefix = `MCP error ${String(error.code)}: `;
    const prefixed = error.message.startsWith(prefix);
    const message = prefixed
      ? error.message.slice(prefix.length)
      : error.message;
    const data = this.#jsonOf(error.data);
    return { kind: "error", code: error.code, message, data };
  }

  #httpAnswerOf(error: StreamableHTTPError): McpAnswer {
    const status = error.code;
    const answered =
      typeof status === "number" && status >= 100 && status <= 599;

    if (!answered) throw this.#unreachable(StreamableHttpMcpClient.UNSPOKEN);

    return { kind: "rejected", statusCode: status };
  }

  #transportOf(
    session: McpSession,
    signal: AbortSignal,
    sessionId?: string,
  ): StreamableHTTPClientTransport {
    const endpoint = new URL(session.endpoint);
    const headers = this.#workflowHeadersOf(session.headers);
    return new StreamableHTTPClientTransport(endpoint, {
      fetch: (url, init) => this.#fetched(session, url, init, signal),
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

  #fetched(
    session: McpSession,
    url: string | URL,
    init: RequestInit | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    const signals = init?.signal ? [signal, init.signal] : [signal];
    const scoped = AbortSignal.any(signals);

    if (session.authorization !== null)
      headers.set("authorization", session.authorization);

    return this.http.fetch(url, {
      method: init?.method,
      headers,
      body: init?.body,
      redirect: init?.redirect,
      signal: scoped,
    });
  }

  #workflowHeadersOf(
    headers: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const kept = Object.entries(headers).filter(([name]) => {
      const lowered = name.toLowerCase();
      const session = StreamableHttpMcpClient.SESSION_HEADERS.includes(lowered);
      return !session;
    });
    return Object.fromEntries(kept);
  }

  #clientOf(session: McpSession): Client {
    const identity = session.client ?? {
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
    transport: StreamableHTTPClientTransport,
    session: McpSession,
  ): Promise<void> {
    const sessionId = transport.sessionId;
    const version = transport.protocolVersion;

    if (sessionId === undefined || version === undefined) return;

    const cleanup = AbortSignal.timeout(
      StreamableHttpMcpClient.CLEANUP_TIMEOUT,
    );
    const ending = this.#transportOf(session, cleanup, sessionId);
    ending.setProtocolVersion(version);
    await ending.terminateSession().catch(() => undefined);
  }

  #jsonOf(value: unknown): JsonValue {
    const defined = value ?? null;
    const text = JSON.stringify(defined);
    return JSON.parse(text) as JsonValue;
  }

  #unreachable(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Unreachable, detail);
  }
}
