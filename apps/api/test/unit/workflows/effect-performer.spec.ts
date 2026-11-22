import { Test } from "@nestjs/testing";
import type {
  Effect,
  HttpOutcome,
  HttpRequest,
  ProcessOutcome,
} from "interpreter";
import { A2aClient } from "../../../src/frameworks/a2a/a2a.client.js";
import { AsyncApiClient } from "../../../src/frameworks/asyncapi/asyncapi.client.js";
import type { SandboxedProcessRequest } from "../../../src/frameworks/go-judge/interfaces.js";
import { SandboxClient } from "../../../src/frameworks/go-judge/sandbox.client.js";
import { GrpcClient } from "../../../src/frameworks/grpc/grpc.client.js";
import { HttpClient } from "../../../src/frameworks/http-client/http.client.js";
import { McpClient } from "../../../src/frameworks/mcp/mcp.client.js";
import { EffectPerformer } from "../../../src/frameworks/workflows/effect-performer.js";
import type {
  CallContext,
  StepCall,
} from "../../../src/frameworks/workflows/interfaces.js";
import { RunController } from "../../../src/interface-adapters/workflows/run.controller.js";

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

  beforeEach(async () => {
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
        { provide: RunController, useValue: {} },
      ],
    }).compile();
    performer = moduleRef.get(EffectPerformer);
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

    const outcome = await performer.perform("instance-1", effect, stepOf());

    expect(outcome).toEqual({ kind: "expired" });
    expect(client.contexts).toHaveLength(0);
  });

  it("a_call_without_a_deadline_reaches_its_client_unbounded", async () => {
    const outcome = await performer.perform(
      "instance-1",
      httpOf(null),
      stepOf(),
    );

    expect(outcome).toEqual(RESPONDED);
    expect(client.contexts[0]).toMatchObject({
      idempotencyKey: "run-1/do/0/charge",
      remaining: null,
    });
  });

  it("a_call_reaches_its_client_with_the_time_that_remains_and_expires_at_it", async () => {
    const effect = httpOf(Date.now() + 100);

    const outcome = await performer.perform("instance-1", effect, stepOf());

    expect(outcome).toEqual({ kind: "expired" });
    const remaining = client.contexts[0]?.remaining ?? 0;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(100);
  });

  it("a_call_whose_step_was_aborted_rejects_with_the_abort_reason", async () => {
    const controller = new AbortController();
    const reason = new Error("The lease was lost");
    const effect = httpOf(Date.now() + 60_000);

    const pending = performer.perform(
      "instance-1",
      effect,
      stepOf(controller.signal),
    );
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it("a_deadline_beyond_the_longest_timer_leaves_the_call_running", async () => {
    const controller = new AbortController();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    const effect = httpOf(Date.now() + sixtyDays);

    const pending = performer.perform(
      "instance-1",
      effect,
      stepOf(controller.signal),
    );
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
});
