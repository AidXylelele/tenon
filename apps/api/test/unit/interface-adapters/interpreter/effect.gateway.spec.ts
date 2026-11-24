import { Test } from "@nestjs/testing";
import type {
  Effect,
  EffectOutcome,
  HttpOutcome,
  ProcessOutcome,
  Resource,
} from "interpreter";
import { A2aGateway } from "../../../../src/interface-adapters/a2a/a2a.gateway.js";
import { AsyncApiGateway } from "../../../../src/interface-adapters/asyncapi/asyncapi.gateway.js";
import { EffectGateway } from "../../../../src/interface-adapters/interpreter/effect.gateway.js";
import { GrpcGateway } from "../../../../src/interface-adapters/grpc/grpc.gateway.js";
import { HttpGateway } from "../../../../src/interface-adapters/http/http.gateway.js";
import { McpGateway } from "../../../../src/interface-adapters/mcp/mcp.gateway.js";
import { OpenApiGateway } from "../../../../src/interface-adapters/http/openapi.gateway.js";
import { ResourceGateway } from "../../../../src/interface-adapters/http/resource.gateway.js";
import { SandboxGateway } from "../../../../src/interface-adapters/sandbox/sandbox.gateway.js";
import type { EffectCall } from "../../../../src/application/automation/instances/interfaces.js";
import type { JsonObject } from "../../../../src/domain/automation/interfaces.js";
import { RunSecrets } from "../../../../src/domain/automation/secrets/run-secrets.js";
import type { SandboxedProcessRequest } from "../../../../src/interface-adapters/sandbox/interfaces.js";
import type {
  CallContext,
  JsonOf,
} from "../../../../src/interface-adapters/interpreter/interfaces.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/interpreter/mappers/protocol.mapper.js";

const RESPONDED: HttpOutcome = {
  kind: "responded",
  request: { method: "GET", uri: "https://crm.example.com", headers: {} },
  statusCode: 200,
  headers: {},
  content: null,
  authorization: null,
};

const EXITED: ProcessOutcome = {
  kind: "exited",
  code: 0,
  stdout: "",
  stderr: "",
};

const DOCUMENT: Resource = {
  name: null,
  endpoint: { uri: "https://docs.example.com/api", authentication: null },
};

const SHELL: SandboxedProcessRequest = {
  kind: "process",
  process: {
    kind: "shell",
    command: "echo done",
    stdin: null,
    arguments: [],
    directory: null,
    environment: {},
  },
  await: false,
};

const COMMON = { id: "do/0/call", deadline: null } as const;

const DETACHED: Effect = { ...COMMON, ...SHELL };

function requestOf(effect: Effect): JsonObject {
  const request: JsonOf<Effect> = effect;
  return request;
}

const ROUTED: readonly Effect[] = [
  {
    ...COMMON,
    kind: "http",
    method: "GET",
    endpoint: DOCUMENT.endpoint,
    headers: {},
    body: null,
    output: "content",
    revealAuthorization: false,
  },
  {
    ...COMMON,
    kind: "openapi",
    document: DOCUMENT,
    operationId: "listPets",
    parameters: {},
    authentication: null,
    output: "content",
    revealAuthorization: false,
  },
  { ...COMMON, kind: "resource", resource: DOCUMENT },
  {
    ...COMMON,
    kind: "grpc",
    proto: DOCUMENT,
    method: "SayHello",
    arguments: {},
    service: { name: "Greeter", host: "grpc.example.com", port: null },
    authentication: null,
  },
  {
    ...COMMON,
    kind: "mcp",
    protocolVersion: "2025-06-18",
    method: "tools/list",
    parameters: null,
    transport: { kind: "http", endpoint: DOCUMENT.endpoint, headers: {} },
    options: {},
    client: null,
  },
  {
    ...COMMON,
    kind: "a2a",
    method: "tasks/get",
    agent: { kind: "server", endpoint: DOCUMENT.endpoint },
    parameters: null,
  },
  {
    ...COMMON,
    kind: "asyncapi",
    document: DOCUMENT,
    authentication: null,
    operation: "sendOrder",
    channel: null,
    server: null,
    protocol: null,
    exchange: { kind: "publish", message: { payload: null, headers: {} } },
  },
  { ...COMMON, ...SHELL },
];

const ANSWERED_BY_THE_RUN: readonly Effect[] = [
  { ...COMMON, kind: "timer", until: 0 },
  {
    ...COMMON,
    kind: "workflow",
    namespace: "default",
    name: "child",
    version: "1.0.0",
    input: null,
    await: true,
  },
];

class ExpiringGateway<T> {
  readonly requests: unknown[] = [];
  readonly contexts: CallContext[] = [];

  constructor(private readonly answer: T) {}

  perform(
    request: unknown,
    context: CallContext,
  ): Promise<T | { kind: "expired" }> {
    this.requests.push(request);
    this.contexts.push(context);

    if (context.signal.aborted) return Promise.resolve({ kind: "expired" });

    if (context.remaining === null) return Promise.resolve(this.answer);

    return new Promise((resolve) => {
      context.signal.addEventListener(
        "abort",
        () => {
          resolve({ kind: "expired" });
        },
        { once: true },
      );
    });
  }
}

describe("the effects every effect passes through", () => {
  let effects: EffectGateway;
  let http: ExpiringGateway<HttpOutcome>;
  let sandbox: ExpiringGateway<ProcessOutcome>;
  let gateways: ReadonlyMap<string, ExpiringGateway<EffectOutcome>>;

  beforeEach(async () => {
    http = new ExpiringGateway(RESPONDED);
    sandbox = new ExpiringGateway(EXITED);
    const others = {
      openapi: new ExpiringGateway<EffectOutcome>(RESPONDED),
      resource: new ExpiringGateway<EffectOutcome>(RESPONDED),
      grpc: new ExpiringGateway<EffectOutcome>(RESPONDED),
      mcp: new ExpiringGateway<EffectOutcome>(RESPONDED),
      a2a: new ExpiringGateway<EffectOutcome>(RESPONDED),
      asyncapi: new ExpiringGateway<EffectOutcome>(RESPONDED),
    };
    const own: [string, ExpiringGateway<EffectOutcome>][] = [
      ["http", http],
      ["process", sandbox],
    ];
    const entries = Object.entries(others).concat(own);
    gateways = new Map(entries);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EffectGateway,
        ProtocolMapper,
        { provide: HttpGateway, useValue: http },
        { provide: OpenApiGateway, useValue: others.openapi },
        { provide: ResourceGateway, useValue: others.resource },
        { provide: GrpcGateway, useValue: others.grpc },
        { provide: McpGateway, useValue: others.mcp },
        { provide: A2aGateway, useValue: others.a2a },
        { provide: AsyncApiGateway, useValue: others.asyncapi },
        { provide: SandboxGateway, useValue: sandbox },
      ],
    }).compile();
    effects = moduleRef.get(EffectGateway);
  });

  function httpOf(deadline: number | null): Effect {
    return {
      id: "do/0/charge",
      deadline,
      kind: "http",
      method: "GET",
      endpoint: { uri: "https://crm.example.com", authentication: null },
      headers: {},
      body: null,
      output: "content",
      revealAuthorization: false,
    };
  }

  function stepOf(
    signal: AbortSignal = new AbortController().signal,
  ): EffectCall {
    const secrets = RunSecrets.of([]);
    return { instanceId: "run-1", effectId: "/do/0/charge", signal, secrets };
  }

  it.each(ROUTED)("a_$kind_effect_reaches_its_own_gateway", async (effect) => {
    const step = stepOf();

    const request = requestOf(effect);
    await effects.perform(request, step);

    const reached = Array.from(gateways).filter(
      ([, gateway]) => gateway.requests.length > 0,
    );
    const kinds = reached.map(([kind]) => kind);
    const gateway = gateways.get(effect.kind);
    expect(kinds).toEqual([effect.kind]);
    expect(gateway?.requests).toEqual([effect]);
  });

  it.each(ANSWERED_BY_THE_RUN)(
    "a_$kind_effect_the_run_answers_itself_reaches_no_gateway",
    async (effect) => {
      const step = stepOf();

      const request = requestOf(effect);
      const performed = effects.perform(request, step);

      await expect(performed).rejects.toThrow(
        `The host does not perform '${effect.kind}'`,
      );
      const reached = Array.from(gateways.values()).filter(
        (gateway) => gateway.requests.length > 0,
      );
      expect(reached).toEqual([]);
    },
  );

  it("a_call_whose_deadline_has_passed_expires_without_reaching_its_gateway", async () => {
    const past = Date.now() - 1;
    const effect = httpOf(past);
    const step = stepOf();

    const request = requestOf(effect);
    const outcome = await effects.perform(request, step);

    expect(outcome).toEqual({ kind: "expired" });
    expect(http.contexts).toHaveLength(0);
  });

  it("a_call_without_a_deadline_reaches_its_gateway_unbounded", async () => {
    const effect = httpOf(null);
    const step = stepOf();

    const request = requestOf(effect);
    const outcome = await effects.perform(request, step);

    expect(outcome).toEqual(RESPONDED);
    expect(http.contexts[0]).toMatchObject({
      idempotencyKey: "run-1:/do/0/charge",
      remaining: null,
    });
  });

  it("a_call_reaches_its_gateway_with_the_time_that_remains_and_expires_at_it", async () => {
    const soon = Date.now() + 100;
    const effect = httpOf(soon);
    const step = stepOf();

    const request = requestOf(effect);
    const outcome = await effects.perform(request, step);

    expect(outcome).toEqual({ kind: "expired" });
    const remaining = http.contexts[0]?.remaining ?? 0;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(100);
  });

  it("a_call_whose_step_was_aborted_rejects_with_the_abort_reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The lease was lost");
    const later = Date.now() + 60_000;
    const effect = httpOf(later);
    const step = stepOf(controller.signal);

    const request = requestOf(effect);
    const pending = effects.perform(request, step);
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it("a_deadline_beyond_the_longest_timer_leaves_the_call_running", async () => {
    const controller = new AbortController();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    const far = Date.now() + sixtyDays;
    const effect = httpOf(far);
    const step = stepOf(controller.signal);

    const request = requestOf(effect);
    const pending = effects.perform(request, step);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const aborted = http.contexts[0]?.signal.aborted;
    const ended = new Error("The step ended");
    controller.abort(ended);

    await expect(pending).rejects.toThrow("The step ended");
    expect(aborted).toBe(false);
  });

  it("a_detached_process_reaches_the_sandbox_unbounded", async () => {
    const step = stepOf();

    const request = requestOf(DETACHED);
    await effects.performDetached(request, step);

    expect(sandbox.requests).toEqual([DETACHED]);
    expect(sandbox.contexts[0]?.remaining).toBeNull();
  });

  it("a_detached_process_whose_step_was_aborted_rejects_with_the_abort_reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The worker is shutting down");
    controller.abort(reason);
    const step = stepOf(controller.signal);

    const request = requestOf(DETACHED);
    const pending = effects.performDetached(request, step);

    await expect(pending).rejects.toBe(reason);
  });

  it("a_container_process_is_refused_as_one_the_host_does_not_perform", async () => {
    const container: Effect = {
      id: "/do/0/build",
      deadline: null,
      kind: "process",
      process: {
        kind: "container",
        image: "alpine:3.22",
        name: null,
        command: null,
        ports: {},
        volumes: {},
        environment: {},
        lifetime: { cleanup: "always", after: null },
        pullPolicy: "ifNotPresent",
        stdin: null,
        arguments: [],
      },
      await: true,
    };

    const request = requestOf(container);
    const step = stepOf();

    const performed = effects.performDetached(request, step);

    await expect(performed).rejects.toThrow(
      "The host does not perform 'process.container'",
    );
  });
});
