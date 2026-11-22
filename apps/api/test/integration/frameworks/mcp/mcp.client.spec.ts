import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplicationContext } from "@nestjs/common";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type { Authentication, JsonObject, JsonValue } from "interpreter";
import { z } from "zod";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../../src/frameworks/di/host.presets.js";
import { AddressPolicy } from "../../../../src/frameworks/network/address-policy.js";
import { TransportFailures } from "../../../../src/interface-adapters/workflows/effects/transport-failures.js";
import type { HttpMcpRequest } from "../../../../src/frameworks/mcp/interfaces.js";
import { McpClient } from "../../../../src/frameworks/mcp/mcp.client.js";
import type { CallContext } from "../../../../src/interface-adapters/workflows/effects/interfaces.js";
import { closedPort } from "../../../support/stub-server.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  httpClientOf,
} from "../../../support/outbound.js";

const TOKEN = "token-1";
const DATED = new Map([
  ["/ancient", "1999-01-01"],
  ["/older", "2025-03-26"],
]);
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";

interface Initialized {
  readonly client: unknown;
  readonly headers: IncomingMessage["headers"];
}

describe("a call the MCP client performs for a run", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let policy: AddressPolicy;
  let client: McpClient;
  let server: Server;
  let origin = "";
  let port = 0;
  const initialized: Initialized[] = [];
  const received: string[] = [];
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    policy = new AddressPolicy(["127.0.0.1"]);
    client = mcpClientOf(policy);
    server = createServer((request, response) => {
      void serve(request, response);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
    origin = `http://127.0.0.1:${String(port)}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await policy.onApplicationShutdown();
    await context.close();
  });

  function mcpClientOf(guard: AddressPolicy): McpClient {
    const authentication = authenticationOf(fetchClientOf(guard.dispatcher));
    const http = httpClientOf(guard, resilience);
    return new McpClient(
      authentication,
      http,
      new TransportFailures(),
      resilience,
    );
  }

  beforeEach(() => {
    initialized.length = 0;
    received.length = 0;
  });

  async function serve(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const path = new URL(request.url ?? "/", origin).pathname;
    received.push(`${request.method ?? ""} ${path}`);

    if (path === "/hang") return;

    if (path === "/redirect") {
      response.writeHead(307, { location: "/mcp" }).end();
      return;
    }

    if (path === "/elsewhere") {
      const target = `http://localhost:${String(port)}/mcp`;
      response.writeHead(307, { location: target }).end();
      return;
    }

    const dated = DATED.get(path);

    if (dated !== undefined) {
      await initializeAt(request, response, dated);
      return;
    }

    if (path === "/gone") {
      response.writeHead(404).end();
      return;
    }

    if (path === "/garbled") {
      const garbled = JSON.parse(await bodyOf(request)) as { id?: number };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: garbled.id,
          result: { tools: "none" },
        }),
      );
      return;
    }

    if (
      path === "/protected" &&
      request.headers.authorization !== `Bearer ${TOKEN}`
    ) {
      response.writeHead(401).end();
      return;
    }

    const session = request.headers["mcp-session-id"];

    if (typeof session === "string") {
      const open = sessions.get(session);

      if (open === undefined) {
        response.writeHead(404).end();
        return;
      }

      const text = request.method === "POST" ? await bodyOf(request) : "";
      const parsed: unknown = text === "" ? undefined : JSON.parse(text);
      await open.handleRequest(request, response, parsed);
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }

    const body = await bodyOf(request);
    const message = JSON.parse(body) as {
      method?: string;
      params?: JsonObject;
    };

    if (message.method === "initialize")
      initialized.push({
        client: message.params?.clientInfo ?? null,
        headers: request.headers,
      });

    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
        },
      });
    transport.onclose = () => {
      sessions.delete(transport.sessionId ?? "");
    };
    await mcpServer().connect(transport);
    await transport.handleRequest(request, response, message);
  }

  function mcpServer(): McpServer {
    const mcp = new McpServer({ name: "stub", version: "1.0.0" });
    mcp.registerTool(
      "add",
      {
        description: "Adds two numbers",
        inputSchema: { a: z.number(), b: z.number() },
      },
      ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
    );
    mcp.registerTool("flood", { description: "Answers 2 MiB" }, () => ({
      content: [{ type: "text", text: "x".repeat(2 * 1024 * 1024) }],
    }));
    mcp.registerTool(
      "wait",
      { description: "Never answers" },
      () => new Promise<never>(() => undefined),
    );
    mcp.registerPrompt(
      "greet",
      { description: "Greets a person", argsSchema: { name: z.string() } },
      ({ name }) => ({
        messages: [
          { role: "user", content: { type: "text", text: `Hello, ${name}` } },
        ],
      }),
    );
    mcp.registerResource(
      "note",
      "note://1",
      { description: "The first note", mimeType: "text/plain" },
      (uri) => ({ contents: [{ uri: uri.href, text: "Buy milk" }] }),
    );
    mcp.registerResource(
      "notes",
      new ResourceTemplate("note://{id}", { list: undefined }),
      { description: "A note by id" },
      (uri) => ({ contents: [{ uri: uri.href, text: "A note" }] }),
    );
    return mcp;
  }

  function contextOf(
    secrets: JsonObject = {},
    remaining: number | null = null,
  ): CallContext {
    return callContextOf("run-1/do/0/ask", secrets, remaining);
  }

  function mcpOf(
    method: HttpMcpRequest["method"],
    parameters: JsonValue = null,
    path = "/mcp",
    authentication: Authentication | null = null,
  ): HttpMcpRequest {
    return {
      kind: "mcp",
      protocolVersion: "2025-06-18",
      method,
      parameters,
      transport: {
        kind: "http",
        endpoint: { uri: `${origin}${path}`, authentication },
        headers: {},
      },
      options: {},
      client: null,
    };
  }

  describe("methods", () => {
    it("the_tools_of_the_server_are_listed", async () => {
      const outcome = await client.call(mcpOf("tools/list"), contextOf());

      expect(outcome).toMatchObject({
        kind: "answered",
        result: {
          tools: [
            { name: "add", description: "Adds two numbers" },
            { name: "flood", description: "Answers 2 MiB" },
            { name: "wait", description: "Never answers" },
          ],
        },
      });
    });

    it("a_tool_is_called_with_its_arguments", async () => {
      const request = mcpOf("tools/call", {
        name: "add",
        arguments: { a: 2, b: 3 },
      });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "answered",
        result: { content: [{ type: "text", text: "5" }] },
      });
    });

    it("a_tool_that_fails_answers_its_error_as_a_result", async () => {
      const request = mcpOf("tools/call", { name: "missing", arguments: {} });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "answered",
        result: {
          content: [
            {
              type: "text",
              text: "MCP error -32602: Tool missing not found",
            },
          ],
          isError: true,
        },
      });
    });

    it("the_prompts_are_listed_and_one_is_got_with_its_arguments", async () => {
      const listed = await client.call(mcpOf("prompts/list"), contextOf());
      const got = await client.call(
        mcpOf("prompts/get", { name: "greet", arguments: { name: "Ada" } }),
        contextOf(),
      );

      expect(listed).toMatchObject({
        kind: "answered",
        result: {
          prompts: [{ name: "greet", description: "Greets a person" }],
        },
      });
      expect(got).toEqual({
        kind: "answered",
        result: {
          messages: [
            { role: "user", content: { type: "text", text: "Hello, Ada" } },
          ],
        },
      });
    });

    it("the_resources_and_their_templates_are_listed_and_one_is_read", async () => {
      const listed = await client.call(mcpOf("resources/list"), contextOf());
      const templates = await client.call(
        mcpOf("resources/templates/list"),
        contextOf(),
      );
      const read = await client.call(
        mcpOf("resources/read", { uri: "note://1" }),
        contextOf(),
      );

      expect(listed).toEqual({
        kind: "answered",
        result: {
          resources: [
            {
              uri: "note://1",
              name: "note",
              description: "The first note",
              mimeType: "text/plain",
            },
          ],
        },
      });
      expect(templates).toEqual({
        kind: "answered",
        result: {
          resourceTemplates: [
            {
              uriTemplate: "note://{id}",
              name: "notes",
              description: "A note by id",
            },
          ],
        },
      });
      expect(read).toEqual({
        kind: "answered",
        result: { contents: [{ uri: "note://1", text: "Buy milk" }] },
      });
    });
  });

  describe("the session", () => {
    it("the_host_initializes_as_the_client_the_document_names", async () => {
      const request: HttpMcpRequest = {
        ...mcpOf("tools/list"),
        client: { name: "synapse", version: "1.0.0-alpha5.2" },
      };

      await client.call(request, contextOf());

      expect(initialized.map((entry) => entry.client)).toEqual([
        { name: "synapse", version: "1.0.0-alpha5.2" },
      ]);
    });

    it("the_host_names_itself_when_the_document_names_no_client", async () => {
      await client.call(mcpOf("tools/list"), contextOf());

      expect(initialized.map((entry) => entry.client)).toEqual([
        { name: "tenon", version: "1.0.0" },
      ]);
    });

    it("the_headers_of_the_transport_travel_with_the_session", async () => {
      const plain = mcpOf("tools/list");
      const request: HttpMcpRequest = {
        ...plain,
        transport: { ...plain.transport, headers: { "x-tenant": "acme" } },
      };

      await client.call(request, contextOf());

      expect(initialized[0]?.headers["x-tenant"]).toBe("acme");
    });

    it("the_session_is_closed_after_the_method", async () => {
      await client.call(mcpOf("tools/list"), contextOf());

      expect(received.at(-1)).toBe("DELETE /mcp");
      expect(sessions.size).toBe(0);
    });

    it("the_session_is_closed_after_a_method_that_expires", async () => {
      const request = mcpOf("tools/call", { name: "wait", arguments: {} });

      const outcome = await client.call(request, contextOf({}, 300));

      expect(outcome).toEqual({ kind: "expired" });
      expect(received).toContain("DELETE /mcp");
      expect(sessions.size).toBe(0);
    });

    it("session_headers_the_workflow_lists_are_not_sent", async () => {
      const plain = mcpOf("tools/list");
      const request: HttpMcpRequest = {
        ...plain,
        transport: {
          ...plain.transport,
          headers: {
            "Mcp-Session-Id": "forged",
            "MCP-Protocol-Version": "1999-01-01",
          },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toMatchObject({ kind: "answered" });
      expect(initialized[0]?.headers["mcp-session-id"]).toBeUndefined();
      expect(initialized[0]?.headers["mcp-protocol-version"]).toBeUndefined();
    });

    it("a_server_older_than_the_version_the_workflow_requires_is_misconfigured", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/older"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "The MCP server speaks a version of the protocol older than 2025-06-18",
      });
      expect(received).toEqual(["POST /older", "POST /older"]);
    });
  });

  describe("authentication", () => {
    it("a_bearer_token_is_sent_with_every_request_of_the_session", async () => {
      const request = mcpOf("tools/list", null, "/protected", {
        kind: "bearer",
        token: TOKEN,
      });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toMatchObject({ kind: "answered" });
    });

    it("a_token_from_a_secret_is_sent", async () => {
      const request = mcpOf("tools/list", null, "/protected", {
        kind: "secret",
        scheme: "bearer",
        secret: "mcp",
      });

      const outcome = await client.call(
        request,
        contextOf({ mcp: { token: TOKEN } }),
      );

      expect(outcome).toMatchObject({ kind: "answered" });
    });

    it("the_authentication_replaces_an_authorization_header_the_author_listed", async () => {
      const plain = mcpOf("tools/list", null, "/protected", {
        kind: "bearer",
        token: TOKEN,
      });
      const request: HttpMcpRequest = {
        ...plain,
        transport: { ...plain.transport, headers: { Authorization: "old" } },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toMatchObject({ kind: "answered" });
    });

    it("credentials_the_server_refuses_are_rejected_with_its_status", async () => {
      const request = mcpOf("tools/list", null, "/protected", {
        kind: "bearer",
        token: "wrong",
      });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 401,
        detail: "The MCP server answered with status 401",
      });
    });

    it("a_secret_the_run_does_not_hold_is_forbidden", async () => {
      const request = mcpOf("tools/list", null, "/protected", {
        kind: "secret",
        scheme: "bearer",
        secret: "mcp",
      });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "forbidden",
        detail: "The secret is not among the secrets of this run",
      });
      expect(received).toHaveLength(0);
    });
  });

  describe("failures", () => {
    it("a_json_rpc_error_of_the_server_is_answered_as_an_rpc_error", async () => {
      const request = mcpOf("prompts/get", { name: "missing" });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "rpcError",
        code: -32602,
        message: "MCP error -32602: Prompt missing not found",
        data: null,
      });
    });

    it("a_protocol_version_the_host_does_not_speak_is_misconfigured", async () => {
      const request: HttpMcpRequest = {
        ...mcpOf("tools/list"),
        protocolVersion: "2099-01-01",
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "The host does not speak this version of the Model Context Protocol",
      });
      expect(received).toHaveLength(0);
    });

    it("parameters_other_than_an_object_are_misconfigured", async () => {
      const request = mcpOf("tools/call", ["add"]);

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The parameters of an MCP method are an object",
      });
    });

    it("a_redirect_within_the_origin_is_followed", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/redirect"),
        contextOf(),
      );

      expect(outcome).toMatchObject({ kind: "answered" });
      expect(received.slice(0, 2)).toEqual(["POST /redirect", "POST /mcp"]);
    });

    it("a_redirect_to_another_origin_is_rejected_and_not_followed", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/elsewhere"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 307,
        detail: "The MCP server answered with status 307",
      });
      expect(received).toEqual(["POST /elsewhere"]);
    });

    it("a_server_answering_a_protocol_version_the_host_does_not_speak_is_unreachable", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/ancient"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "unreachable",
        detail:
          "The MCP session failed: Server's protocol version is not supported: 1999-01-01",
      });
    });

    it("a_status_outside_two_hundreds_is_rejected_with_it", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/gone"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The MCP server answered with status 404",
      });
    });

    it("an_answer_the_protocol_does_not_describe_is_unreachable", async () => {
      const outcome = await client.call(
        mcpOf("tools/list", null, "/garbled"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The MCP server answered other than the protocol describes",
      });
    });

    it("a_call_still_unanswered_at_its_deadline_expires", async () => {
      const request = mcpOf("tools/list", null, "/hang");

      const outcome = await client.call(request, contextOf({}, 200));

      expect(outcome).toEqual({ kind: "expired" });
    });

    it("a_port_nobody_listens_on_is_unreachable", async () => {
      const closed = await closedPort();
      const plain = mcpOf("tools/list");
      const request: HttpMcpRequest = {
        ...plain,
        transport: {
          ...plain.transport,
          endpoint: {
            uri: `http://127.0.0.1:${String(closed)}/mcp`,
            authentication: null,
          },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The service refused the connection",
      });
    });

    it.each(["127.0.0.1", "localhost"])(
      "a_private_destination_%s_is_refused_before_any_connection",
      async (host) => {
        const guarded = new AddressPolicy([]);
        const guardedClient = mcpClientOf(guarded);
        const plain = mcpOf("tools/list");
        const request: HttpMcpRequest = {
          ...plain,
          transport: {
            ...plain.transport,
            endpoint: {
              uri: `http://${host}:${String(port)}/mcp`,
              authentication: null,
            },
          },
        };

        const outcome = await guardedClient.call(request, contextOf());

        expect(outcome).toEqual({
          kind: "unreachable",
          detail: REFUSED_ADDRESS,
        });
        expect(received).toHaveLength(0);
        await guarded.onApplicationShutdown();
      },
    );

    it("a_response_larger_than_its_bound_is_unreachable", async () => {
      const request = mcpOf("tools/call", { name: "flood", arguments: {} });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The response is larger than 1 MiB",
      });
    });
  });
});

async function initializeAt(
  request: IncomingMessage,
  response: ServerResponse,
  protocolVersion: string,
): Promise<void> {
  const message = JSON.parse(await bodyOf(request)) as { id?: number };
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion,
        capabilities: {},
        serverInfo: { name: "dated", version: "0.0.1" },
      },
    }),
  );
}

async function bodyOf(incoming: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of incoming) chunks.push(chunk as Buffer);

  return Buffer.concat(chunks).toString("utf8");
}
