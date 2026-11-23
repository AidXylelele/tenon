import { Injectable } from "@nestjs/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  CallToolResultSchema,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ListToolsResultSchema,
  ReadResourceResultSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  McpAnswer,
  McpCall,
  McpConnection,
  McpMethod,
  McpSession,
} from "../../interface-adapters/workflows/effects/interfaces.js";
import { RELEASE_VERSION } from "../release.js";

@Injectable()
export class StreamableHttpMcpConnection implements McpConnection {
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

  speaks(protocolVersion: string): boolean {
    return SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion);
  }

  async request(
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
      const result = await client.request(
        { method: call.method, params },
        StreamableHttpMcpConnection.RESULTS[call.method],
        options,
      );
      return { kind: "answered", result };
    } finally {
      await client.close();
      await this.#terminated(transport, session);
    }
  }

  #transportOf(
    session: McpSession,
    signal: AbortSignal,
    sessionId?: string,
  ): StreamableHTTPClientTransport {
    const endpoint = new URL(session.endpoint);
    const fetch = session.fetchOf(signal);
    const headers = this.#workflowHeadersOf(session.headers);
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
      const session =
        StreamableHttpMcpConnection.SESSION_HEADERS.includes(lowered);
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
      StreamableHttpMcpConnection.CLEANUP_TIMEOUT,
    );
    const ending = this.#transportOf(session, cleanup, sessionId);
    ending.setProtocolVersion(version);
    await ending.terminateSession().catch(() => undefined);
  }
}
