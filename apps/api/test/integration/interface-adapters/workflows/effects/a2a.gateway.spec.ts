import type { ServerResponse } from "node:http";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type {
  A2aRequest,
  Authentication,
  JsonObject,
  JsonValue,
} from "interpreter";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../../../src/frameworks/di/host.presets.js";
import { AddressPolicy } from "../../../../../src/frameworks/network/address-policy.js";
import { TransportFailures } from "../../../../../src/interface-adapters/workflows/effects/transport-failures.js";
import { A2aGateway } from "../../../../../src/interface-adapters/workflows/effects/a2a.gateway.js";
import { ResponseContent } from "../../../../../src/interface-adapters/workflows/effects/response-content.js";
import type { CallContext } from "../../../../../src/interface-adapters/workflows/effects/interfaces.js";
import {
  closedPort,
  type ReceivedRequest,
  startStubServer,
  type StubServer,
} from "../../../../support/stub-server.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  httpGatewayOf,
  resourcesOf,
} from "../../../../support/outbound.js";

type A2aMethod = A2aRequest["method"];

const TOKEN = "token-1";
const BASIC = `Basic ${Buffer.from("ada:lovelace").toString("base64")}`;
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";
const TASK = {
  kind: "task",
  id: "task-1",
  contextId: "context-1",
  status: { state: "completed" },
};
const CONFIG = {
  taskId: "task-1",
  pushNotificationConfig: { id: "config-1", url: "https://hooks.test/a2a" },
};

interface Envelope {
  readonly id: string;
  readonly method: string;
  readonly params?: JsonObject;
}

describe("a call the A2A gateway performs for a run", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let policy: AddressPolicy;
  let gateway: A2aGateway;
  let stub: StubServer;
  let elsewhere: StubServer;
  let origin = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    policy = new AddressPolicy(["127.0.0.1"]);
    gateway = a2aGatewayOf(policy);
    stub = await startStubServer((request, response) => {
      answer(request, response);
    });
    origin = stub.origin;
    elsewhere = await startStubServer((_request, response) => {
      response.writeHead(200).end();
    });
  });

  afterAll(async () => {
    await stub.close();
    await elsewhere.close();
    await policy.onApplicationShutdown();
    await context.close();
  });

  beforeEach(() => {
    stub.received.length = 0;
  });

  function a2aGatewayOf(guard: AddressPolicy): A2aGateway {
    const authentication = authenticationOf(fetchClientOf(guard.dispatcher));
    return new A2aGateway(
      resourcesOf(guard, resilience),
      httpGatewayOf(guard, resilience),
      authentication,
      new ResponseContent(),
      new TransportFailures(),
      resilience,
    );
  }

  function cardOf(
    path: string,
    secured: boolean,
    transport = "JSONRPC",
  ): JsonObject {
    const card: Record<string, JsonValue> = {
      name: "Reporter",
      description: "Writes reports",
      url: `${origin}${path}`,
      version: "1.0.0",
      protocolVersion: "0.3.0",
      preferredTransport: transport,
      capabilities: { streaming: true },
      defaultInputModes: ["text"],
      defaultOutputModes: ["text"],
      skills: [],
    };

    if (secured) {
      card.securitySchemes = { bearer: { type: "http", scheme: "bearer" } };
      card.security = [{ bearer: [] }];
    }

    return card;
  }

  function answer(request: ReceivedRequest, response: ServerResponse): void {
    const path = new URL(request.url, origin).pathname;
    const authorization = request.headers.authorization;

    if (path === "/.well-known/agent-card.json") {
      json(response, 200, cardOf("/a2a", false));
      return;
    }

    if (path === "/secured-card.json") {
      json(response, 200, cardOf("/secured", true));
      return;
    }

    if (path === "/private-card.json") {
      if (authorization !== BASIC) {
        response.writeHead(401).end();
        return;
      }

      json(response, 200, cardOf("/a2a", false));
      return;
    }

    if (path === "/rest-card.json") {
      json(response, 200, cardOf("/rest", false, "HTTP+JSON"));
      return;
    }

    if (path === "/broken-card.json") {
      json(response, 200, { name: "Reporter", url: 42 });
      return;
    }

    if (path === "/v1-card.json") {
      json(response, 200, {
        name: "Reporter",
        supportedInterfaces: [
          {
            url: `${origin}/a2a`,
            protocolBinding: "JSONRPC",
            protocolVersion: "1.0",
          },
        ],
      });
      return;
    }

    if (path === "/elsewhere-card.json") {
      json(response, 200, {
        ...cardOf("/secured", true),
        url: `${elsewhere.origin}/secured`,
      });
      return;
    }

    if (path === "/secured" && authorization !== `Bearer ${TOKEN}`) {
      response.writeHead(401).end();
      return;
    }

    if (path === "/denied") {
      json(response, 403, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32004, message: "Not permitted" },
      });
      return;
    }

    if (path === "/failing") {
      response.writeHead(502, { "content-type": "text/plain" });
      response.end("bad gateway");
      return;
    }

    if (path === "/garbled") {
      json(response, 200, { answer: 42 });
      return;
    }

    if (path === "/versionless") {
      json(response, 200, { id: "run-1/do/0/report", result: TASK });
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }

    const envelope = JSON.parse(request.body) as Envelope;
    rpc(envelope, response);
  }

  function rpc(envelope: Envelope, response: ServerResponse): void {
    const params = envelope.params ?? {};
    const reply = (result: JsonValue): void => {
      json(response, 200, { jsonrpc: "2.0", id: envelope.id, result });
    };
    const fail = (code: number, message: string, data?: JsonValue): void => {
      json(response, 200, {
        jsonrpc: "2.0",
        id: envelope.id,
        error: data === undefined ? { code, message } : { code, message, data },
      });
    };

    switch (envelope.method) {
      case "message/send": {
        const text = JSON.stringify(params);

        if (text.includes("hang")) return;

        reply({ ...TASK, history: [params.message ?? null] });
        return;
      }
      case "message/stream":
        if (JSON.stringify(params).includes("plain")) {
          reply(TASK);
          return;
        }

        if (JSON.stringify(params).includes("flood")) {
          stream(
            response,
            envelope.id,
            Array.from({ length: 3 }, () => "x".repeat(512 * 1024)),
          );
          return;
        }

        stream(response, envelope.id, [
          { ...TASK, status: { state: "submitted" } },
          {
            kind: "status-update",
            taskId: "task-1",
            contextId: "context-1",
            status: { state: "working" },
            final: false,
          },
          {
            kind: "status-update",
            taskId: "task-1",
            contextId: "context-1",
            status: { state: "completed" },
            final: true,
          },
        ]);
        return;
      case "tasks/resubscribe":
        if (params.id === "broken") {
          response.writeHead(200, { "content-type": "text/event-stream" });
          response.write(
            `data: ${JSON.stringify({ jsonrpc: "2.0", id: envelope.id, result: TASK })}\n\n`,
          );
          response.end(
            `data: ${JSON.stringify({ jsonrpc: "2.0", id: envelope.id, error: { code: -32603, message: "Internal error" } })}\n\n`,
          );
          return;
        }

        stream(response, envelope.id, [
          {
            kind: "artifact-update",
            taskId: "task-1",
            contextId: "context-1",
            artifact: {
              artifactId: "report",
              parts: [{ kind: "text", text: "Q1" }],
            },
          },
          TASK,
        ]);
        return;
      case "tasks/get":
        if (params.id === "missing") {
          fail(-32001, "Task not found", { id: "missing" });
          return;
        }

        reply(TASK);
        return;
      case "tasks/list":
        fail(-32601, "Method not found");
        return;
      case "tasks/cancel":
        fail(-32002, "Task cannot be canceled");
        return;
      case "tasks/pushNotificationConfig/set":
      case "tasks/pushNotificationConfig/get":
        reply(CONFIG);
        return;
      case "tasks/pushNotificationConfig/list":
        reply([CONFIG]);
        return;
      case "tasks/pushNotificationConfig/delete":
        reply(null);
        return;
      case "agent/getAuthenticatedExtendedCard":
        reply(cardOf("/a2a", false));
        return;
      default:
        fail(-32601, "Method not found");
    }
  }

  function contextOf(
    secrets: JsonObject = {},
    remaining: number | null = null,
  ): CallContext {
    return callContextOf("run-1/do/0/report", secrets, remaining);
  }

  function serverOf(
    method: A2aMethod,
    parameters: JsonValue,
    path = "/a2a",
    authentication: Authentication | null = null,
  ): A2aRequest {
    return {
      kind: "a2a",
      method,
      agent: {
        kind: "server",
        endpoint: { uri: `${origin}${path}`, authentication },
      },
      parameters,
    };
  }

  function cardedOf(
    method: A2aMethod,
    parameters: JsonValue,
    path = "/.well-known/agent-card.json",
    authentication: Authentication | null = null,
  ): A2aRequest {
    return {
      kind: "a2a",
      method,
      agent: {
        kind: "card",
        card: {
          name: null,
          endpoint: { uri: `${origin}${path}`, authentication },
        },
      },
      parameters,
    };
  }

  const MESSAGE = {
    message: {
      messageId: "6f1c2a54-7d1e-5b0f-9b5e-3c1d2e3f4a5b",
      role: "user",
      parts: [{ kind: "text", text: "Generate the Q1 sales report." }],
    },
  };

  describe("methods", () => {
    it.each<[A2aMethod, JsonValue, JsonValue]>([
      ["message/send", MESSAGE, { ...TASK, history: [MESSAGE.message] }],
      ["tasks/get", { id: "task-1" }, TASK],
      ["tasks/pushNotificationConfig/set", CONFIG, CONFIG],
      ["tasks/pushNotificationConfig/get", { id: "task-1" }, CONFIG],
      ["tasks/pushNotificationConfig/list", { id: "task-1" }, [CONFIG]],
      [
        "tasks/pushNotificationConfig/delete",
        { id: "task-1", pushNotificationConfigId: "config-1" },
        null,
      ],
    ])("%s_answers_the_json_rpc_result", async (method, parameters, result) => {
      const outcome = await gateway.perform(
        serverOf(method, parameters),
        contextOf(),
      );

      expect(outcome).toEqual({ kind: "answered", result });
    });

    it("agent_get_authenticated_extended_card_answers_the_card", async () => {
      const outcome = await gateway.perform(
        serverOf("agent/getAuthenticatedExtendedCard", null),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "answered",
        result: {
          name: "Reporter",
          description: "Writes reports",
          url: `${origin}/a2a`,
          version: "1.0.0",
          protocolVersion: "0.3.0",
          preferredTransport: "JSONRPC",
          capabilities: { streaming: true },
          defaultInputModes: ["text"],
          defaultOutputModes: ["text"],
          skills: [],
        },
      });
    });

    it("message_stream_answers_the_ordered_results_of_the_stream", async () => {
      const outcome = await gateway.perform(
        serverOf("message/stream", MESSAGE),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "answered",
        result: [
          { ...TASK, status: { state: "submitted" } },
          {
            kind: "status-update",
            taskId: "task-1",
            contextId: "context-1",
            status: { state: "working" },
            final: false,
          },
          {
            kind: "status-update",
            taskId: "task-1",
            contextId: "context-1",
            status: { state: "completed" },
            final: true,
          },
        ],
      });
    });

    it("a_stream_answered_with_plain_json_answers_a_list_of_its_one_result", async () => {
      const plain = { ...MESSAGE, metadata: { reply: "plain" } };

      const outcome = await gateway.perform(
        serverOf("message/stream", plain),
        contextOf(),
      );

      expect(outcome).toEqual({ kind: "answered", result: [TASK] });
    });

    it("tasks_resubscribe_answers_the_ordered_results_of_the_stream", async () => {
      const outcome = await gateway.perform(
        serverOf("tasks/resubscribe", { id: "task-1" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "answered",
        result: [
          {
            kind: "artifact-update",
            taskId: "task-1",
            contextId: "context-1",
            artifact: {
              artifactId: "report",
              parts: [{ kind: "text", text: "Q1" }],
            },
          },
          TASK,
        ],
      });
    });

    it("the_request_is_one_json_rpc_envelope_keyed_by_the_step", async () => {
      await gateway.perform(
        serverOf("tasks/get", { id: "task-1" }),
        contextOf(),
      );

      const [received] = stub.received;
      assert.exists(received);
      expect(stub.received).toHaveLength(1);
      expect(JSON.parse(received.body)).toEqual({
        jsonrpc: "2.0",
        id: "run-1/do/0/report",
        method: "tasks/get",
        params: { id: "task-1" },
      });
      expect(received.headers["idempotency-key"]).toBe("run-1/do/0/report");
    });

    it("a_method_without_parameters_sends_none", async () => {
      await gateway.perform(
        serverOf("agent/getAuthenticatedExtendedCard", null),
        contextOf(),
      );

      const [received] = stub.received;
      assert.exists(received);
      expect(JSON.parse(received.body)).toEqual({
        jsonrpc: "2.0",
        id: "run-1/do/0/report",
        method: "agent/getAuthenticatedExtendedCard",
      });
    });
  });

  describe("the agent card", () => {
    it("the_agent_is_called_at_the_json_rpc_url_of_its_card", async () => {
      const outcome = await gateway.perform(
        cardedOf("tasks/get", { id: "task-1" }),
        contextOf(),
      );

      expect(outcome).toEqual({ kind: "answered", result: TASK });
      expect(stub.received.map((received) => received.url)).toEqual([
        "/.well-known/agent-card.json",
        "/a2a",
      ]);
    });

    it("the_card_is_read_with_the_authentication_of_its_resource_which_an_open_agent_does_not_receive", async () => {
      const request = cardedOf(
        "tasks/get",
        { id: "task-1" },
        "/private-card.json",
        {
          kind: "basic",
          username: "ada",
          password: "lovelace",
        },
      );

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "answered", result: TASK });
      expect(
        stub.received.map((received) => received.headers.authorization ?? null),
      ).toEqual([BASIC, null]);
    });

    it("an_agent_whose_card_requires_authentication_receives_the_credentials", async () => {
      const request = cardedOf(
        "tasks/get",
        { id: "task-1" },
        "/secured-card.json",
        {
          kind: "bearer",
          token: TOKEN,
        },
      );

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "answered", result: TASK });
      expect(stub.received.map((received) => received.url)).toEqual([
        "/secured-card.json",
        "/secured",
      ]);
    });

    it.each([
      [
        "/rest-card.json",
        "The agent card offers no JSON-RPC interface of A2A 0.3",
      ],
      [
        "/v1-card.json",
        "The agent card offers no JSON-RPC interface of A2A 0.3",
      ],
      ["/broken-card.json", "The agent card cannot be read"],
    ])("the_card_at_%s_is_misconfigured", async (path, detail) => {
      const outcome = await gateway.perform(
        cardedOf("tasks/get", { id: "task-1" }, path),
        contextOf(),
      );

      expect(outcome).toEqual({ kind: "misconfigured", detail });
    });

    it("a_card_naming_an_agent_at_another_origin_does_not_receive_the_credentials", async () => {
      const request = cardedOf(
        "tasks/get",
        { id: "task-1" },
        "/elsewhere-card.json",
        { kind: "bearer", token: TOKEN },
      );

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "The agent card names an agent at another origin, which its credentials are not sent to",
      });
      expect(elsewhere.received).toHaveLength(0);
    });

    it("a_card_the_server_does_not_have_is_rejected_with_its_status", async () => {
      const outcome = await gateway.perform(
        cardedOf("tasks/get", { id: "task-1" }, "/missing-card.json"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The server answered the resource with status 404",
      });
    });
  });

  describe("authentication", () => {
    it("a_token_from_a_secret_reaches_the_server", async () => {
      const request = serverOf("tasks/get", { id: "task-1" }, "/secured", {
        kind: "secret",
        scheme: "bearer",
        secret: "agent",
      });

      const outcome = await gateway.perform(
        request,
        contextOf({ agent: { token: TOKEN } }),
      );

      expect(outcome).toEqual({ kind: "answered", result: TASK });
    });

    it("credentials_the_agent_refuses_are_rejected_with_its_status", async () => {
      const request = serverOf("tasks/get", { id: "task-1" }, "/secured", {
        kind: "bearer",
        token: "wrong",
      });

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 401,
        detail: "The agent answered with status 401",
      });
    });

    it("a_secret_the_run_does_not_hold_is_forbidden", async () => {
      const request = serverOf("tasks/get", { id: "task-1" }, "/secured", {
        kind: "secret",
        scheme: "bearer",
        secret: "agent",
      });

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "forbidden",
        detail: "The secret is not among the secrets of this run",
      });
      expect(stub.received).toHaveLength(0);
    });
  });

  describe("failures", () => {
    it.each<[A2aMethod, JsonValue, JsonValue]>([
      ["tasks/get", { id: "missing" }, { id: "missing" }],
      ["tasks/list", {}, null],
      ["tasks/cancel", { id: "task-1" }, null],
    ])(
      "a_json_rpc_error_of_%s_is_answered_as_an_rpc_error",
      async (method, parameters, data) => {
        const codes = new Map([
          ["tasks/get", [-32001, "Task not found"]],
          ["tasks/list", [-32601, "Method not found"]],
          ["tasks/cancel", [-32002, "Task cannot be canceled"]],
        ]);
        const answer = codes.get(method);
        assert.exists(answer);
        const [code, message] = answer;

        const outcome = await gateway.perform(
          serverOf(method, parameters),
          contextOf(),
        );

        expect(outcome).toEqual({ kind: "rpcError", code, message, data });
      },
    );

    it("an_error_inside_a_stream_ends_it_as_an_rpc_error", async () => {
      const outcome = await gateway.perform(
        serverOf("tasks/resubscribe", { id: "broken" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rpcError",
        code: -32603,
        message: "Internal error",
        data: null,
      });
    });

    it("an_answer_that_is_not_json_rpc_is_unreachable", async () => {
      const outcome = await gateway.perform(
        serverOf("tasks/get", { id: "task-1" }, "/garbled"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The agent answered other than JSON-RPC",
      });
    });

    it("an_envelope_of_another_json_rpc_version_is_unreachable", async () => {
      const outcome = await gateway.perform(
        serverOf("tasks/get", { id: "task-1" }, "/versionless"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The agent answered other than JSON-RPC",
      });
    });

    it("a_status_without_an_envelope_is_rejected_with_it", async () => {
      const outcome = await gateway.perform(
        serverOf("message/stream", MESSAGE, "/failing"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 502,
        detail: "The agent answered with status 502",
      });
    });

    it("a_status_with_a_json_rpc_error_is_answered_as_the_rpc_error", async () => {
      const outcome = await gateway.perform(
        serverOf("tasks/get", { id: "task-1" }, "/denied"),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "rpcError",
        code: -32004,
        message: "Not permitted",
        data: null,
      });
    });

    it("a_stream_larger_than_its_bound_is_unreachable", async () => {
      const request = serverOf("message/stream", {
        message: {
          ...MESSAGE.message,
          parts: [{ kind: "text", text: "flood" }],
        },
      });

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The response is larger than 1 MiB",
      });
    });

    it("a_call_still_unanswered_at_its_deadline_expires", async () => {
      const request = serverOf("message/send", {
        message: {
          ...MESSAGE.message,
          parts: [{ kind: "text", text: "hang" }],
        },
      });

      const outcome = await gateway.perform(request, contextOf({}, 200));

      expect(outcome).toEqual({ kind: "expired" });
    });

    it("a_port_nobody_listens_on_is_unreachable", async () => {
      const closed = await closedPort();
      const request: A2aRequest = {
        ...serverOf("tasks/get", { id: "task-1" }),
        agent: {
          kind: "server",
          endpoint: {
            uri: `http://127.0.0.1:${String(closed)}/a2a`,
            authentication: null,
          },
        },
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The service refused the connection",
      });
    });

    it.each(["127.0.0.1", "localhost"])(
      "a_private_card_or_agent_at_%s_is_refused_before_any_connection",
      async (host) => {
        const guarded = new AddressPolicy([]);
        const guardedGateway = a2aGatewayOf(guarded);
        const uri = `http://${host}:${String(stub.port)}`;
        const carded: A2aRequest = {
          ...cardedOf("tasks/get", { id: "task-1" }),
          agent: {
            kind: "card",
            card: {
              name: null,
              endpoint: {
                uri: `${uri}/.well-known/agent-card.json`,
                authentication: null,
              },
            },
          },
        };
        const served: A2aRequest = {
          ...serverOf("tasks/get", { id: "task-1" }),
          agent: {
            kind: "server",
            endpoint: { uri: `${uri}/a2a`, authentication: null },
          },
        };

        const outcomes = [
          await guardedGateway.perform(carded, contextOf()),
          await guardedGateway.perform(served, contextOf()),
        ];

        expect(outcomes).toEqual([
          { kind: "unreachable", detail: REFUSED_ADDRESS },
          { kind: "unreachable", detail: REFUSED_ADDRESS },
        ]);
        expect(stub.received).toHaveLength(0);
        await guarded.onApplicationShutdown();
      },
    );
  });
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function stream(
  response: ServerResponse,
  id: string,
  results: readonly JsonValue[],
): void {
  response.writeHead(200, { "content-type": "text/event-stream" });

  for (const result of results)
    response.write(
      `data: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`,
    );

  response.end();
}
