import { Test } from "@nestjs/testing";
import { trace } from "@opentelemetry/api";
import type {
  Effect,
  HttpOutcome,
  HttpRequest,
  ProcessOutcome,
} from "interpreter";
import { A2aClient } from "../../../src/frameworks/a2a/a2a.client.js";
import { AsyncApiClient } from "../../../src/frameworks/asyncapi/asyncapi.client.js";
import { SandboxClient } from "../../../src/frameworks/go-judge/sandbox.client.js";
import { GrpcClient } from "../../../src/frameworks/grpc/grpc.client.js";
import { HttpClient } from "../../../src/frameworks/http-client/http.client.js";
import { McpClient } from "../../../src/frameworks/mcp/mcp.client.js";
import { EffectPerformer } from "../../../src/frameworks/interpreter/effect-performer.js";
import type { CallContext } from "../../../src/frameworks/interpreter/interfaces.js";
import { PermanentFault } from "../../../src/domain/errors.js";
import type {
  SandboxedProcessRequest,
  StepCall,
} from "../../../src/interface-adapters/workflows/interfaces.js";
import { RecordedMetrics } from "../../support/recorded-metrics.js";
import { RecordedSpans } from "../../support/recorded-spans.js";

const RESPONDED: HttpOutcome = {
  kind: "responded",
  request: { method: "GET", uri: "https://crm.example.com", headers: {} },
  statusCode: 200,
  headers: {},
  content: null,
  authorization: null,
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

class ExpiringClient {
  readonly contexts: CallContext[] = [];

  send(_request: HttpRequest, context: CallContext): Promise<HttpOutcome> {
    return this.#untilAborted(context, RESPONDED);
  }

  run(
    _request: SandboxedProcessRequest,
    context: CallContext,
  ): Promise<ProcessOutcome> {
    return this.#untilAborted(context, {
      kind: "exited",
      code: 0,
      stdout: "",
      stderr: "",
    });
  }

  #untilAborted<T>(
    context: CallContext,
    answer: T,
  ): Promise<T | { kind: "expired" }> {
    this.contexts.push(context);

    if (context.signal.aborted) return Promise.resolve({ kind: "expired" });

    if (context.remaining === null) return Promise.resolve(answer);

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

describe("the performer every effect passes through", () => {
  let performer: EffectPerformer;
  let client: ExpiringClient;
  let recorded: RecordedMetrics;

  beforeEach(async () => {
    recorded = new RecordedMetrics();
    client = new ExpiringClient();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EffectPerformer,
        { provide: HttpClient, useValue: client },
        { provide: GrpcClient, useValue: {} },
        { provide: McpClient, useValue: {} },
        { provide: A2aClient, useValue: {} },
        { provide: AsyncApiClient, useValue: {} },
        { provide: SandboxClient, useValue: client },
      ],
    }).compile();
    performer = moduleRef.get(EffectPerformer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  ): StepCall {
    return { idempotencyKey: "run-1/do/0/charge", signal, secrets: {} };
  }

  it("a_call_whose_deadline_has_passed_expires_without_reaching_its_client", async () => {
    const effect = httpOf(Date.now() - 1);

    const outcome = await performer.perform(effect, stepOf());

    expect(outcome).toEqual({ kind: "expired" });
    expect(client.contexts).toHaveLength(0);
  });

  it("a_call_without_a_deadline_reaches_its_client_unbounded", async () => {
    const outcome = await performer.perform(httpOf(null), stepOf());

    expect(outcome).toEqual(RESPONDED);
    expect(client.contexts[0]).toMatchObject({
      idempotencyKey: "run-1/do/0/charge",
      remaining: null,
    });
  });

  it("a_call_reaches_its_client_with_the_time_that_remains_and_expires_at_it", async () => {
    const effect = httpOf(Date.now() + 100);

    const outcome = await performer.perform(effect, stepOf());

    expect(outcome).toEqual({ kind: "expired" });
    const remaining = client.contexts[0]?.remaining ?? 0;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(100);
  });

  it("a_call_whose_step_was_aborted_rejects_with_the_abort_reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The lease was lost");
    const effect = httpOf(Date.now() + 60_000);

    const pending = performer.perform(effect, stepOf(controller.signal));
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it("a_deadline_beyond_the_longest_timer_leaves_the_call_running", async () => {
    const controller = new AbortController();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    const effect = httpOf(Date.now() + sixtyDays);

    const pending = performer.perform(effect, stepOf(controller.signal));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const aborted = client.contexts[0]?.signal.aborted;
    controller.abort(new Error("The step ended"));

    await expect(pending).rejects.toThrow("The step ended");
    expect(aborted).toBe(false);
  });

  it("a_detached_process_whose_step_was_aborted_rejects_with_the_abort_reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The worker is shutting down");
    controller.abort(reason);

    const pending = performer.performDetached(SHELL, stepOf(controller.signal));

    await expect(pending).rejects.toBe(reason);
  });

  it("measures_an_effect_by_its_kind_and_outcome_and_names_its_kind_on_the_step_span", async () => {
    const spans = new RecordedSpans();
    const tracer = trace.getTracer("test");

    await tracer.startActiveSpan("step effect", async (span) => {
      await performer.perform(httpOf(null), stepOf());
      span.end();
    });
    await spans.stop();

    const [step] = spans.named("step effect");
    const [measured] = recorded.pointsOf("tenon.effect.duration");
    expect(step?.attributes).toEqual({ "tenon.effect.kind": "http" });
    expect(measured?.attributes).toEqual({
      "tenon.effect.kind": "http",
      "tenon.effect.outcome": "responded",
    });
    const options = recorded.optionsOf("tenon.effect.duration");
    const longest = options?.advice?.explicitBucketBoundaries?.slice(-2);
    expect(measured?.value).toBeGreaterThanOrEqual(0);
    expect(options?.unit).toBe("s");
    expect(longest).toEqual([30, 60]);
  });

  it("measures_an_effect_that_threw_by_its_error_type", async () => {
    const terminated = new TypeError("terminated");
    vi.spyOn(client, "send").mockRejectedValue(terminated);

    await expect(performer.perform(httpOf(null), stepOf())).rejects.toBe(
      terminated,
    );

    const [measured] = recorded.pointsOf("tenon.effect.duration");
    expect(measured?.attributes).toEqual({
      "tenon.effect.kind": "http",
      "error.type": "TypeError",
    });
  });

  it("a_container_process_is_refused_as_one_the_host_does_not_perform", () => {
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

    expect(() => performer.sandboxed(container)).toThrow(PermanentFault);
  });

  it("a_sandboxed_process_is_handed_on_as_it_is", () => {
    const shell: Effect = {
      id: "/do/0/run",
      deadline: null,
      kind: "process",
      process: SHELL.process,
      await: false,
    };

    expect(performer.sandboxed(shell)).toBe(shell);
  });
});
