import type { INestApplicationContext } from "@nestjs/common";
import {
  ResilienceModule,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import {
  context,
  createNoopMeter,
  metrics,
  type ObservableCallback,
  propagation,
  ROOT_CONTEXT,
  trace,
  TraceFlags,
} from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { JsonObject, State } from "interpreter";
import { Piscina } from "piscina";
import { interpreterPresetsOf } from "../../../../src/frameworks/di/host.presets.js";
import { PiscinaInterpreterClient } from "../../../../src/frameworks/interpreter/piscina-interpreter.client.js";

const THREADS = { runs: 10, checks: 2 };
const PRESETS = interpreterPresetsOf(THREADS);

const waiting: JsonObject = {
  document: {
    dsl: "1.1.0",
    namespace: "sales",
    name: "pause",
    version: "1.0.0",
  },
  do: [{ pause: { wait: { seconds: 30 } } }, { done: { set: { done: true } } }],
};

const fetchingWith = (authentication: JsonObject): JsonObject => ({
  document: {
    dsl: "1.1.0",
    namespace: "sales",
    name: "fetch",
    version: "1.0.0",
  },
  do: [
    {
      fetch: {
        call: "http",
        with: {
          method: "get",
          endpoint: { uri: "https://crm.example.com", authentication },
        },
      },
    },
  ],
});

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const CALLER_ID = "00f067aa0ba902b7";

const moment = {
  now: Date.UTC(2026, 0, 1),
  secrets: {},
  runtime: { name: "tenon", version: "0.0.1", metadata: {} },
};

describe("the interpreter on its Piscina threads", () => {
  const sdk = new NodeSDK({
    autoDetectResources: false,
    instrumentations: [],
    spanProcessors: [],
    metricReaders: [],
    logRecordProcessors: [],
  });
  const meter = createNoopMeter();
  const gauges = new Map<string, ObservableCallback>();
  const run = vi.spyOn(Piscina.prototype, "run");
  let app: INestApplicationContext;
  let client: PiscinaInterpreterClient;
  let sources = 0;

  const callOf = (versionId: string, fingerprint: string | null = null) => ({
    versionId,
    fingerprint,
    signal: null,
    source: () => {
      sources += 1;
      return Promise.resolve({ document: waiting, imports: {}, secrets: [] });
    },
  });

  beforeAll(async () => {
    sdk.start();
    vi.spyOn(meter, "createObservableGauge").mockImplementation((name) => ({
      addCallback: (callback) => {
        gauges.set(name, callback);
      },
      removeCallback: () => undefined,
    }));
    vi.spyOn(metrics, "getMeter").mockReturnValue(meter);
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: PRESETS })],
      providers: [
        {
          provide: PiscinaInterpreterClient,
          inject: [ResilienceService],
          useFactory: (resilience: ResilienceService) =>
            new PiscinaInterpreterClient(resilience, {}, THREADS),
        },
      ],
    }).compile();
    app = await moduleRef.init();
    client = app.get(PiscinaInterpreterClient);
  });

  afterAll(async () => {
    await app.close();
    await sdk.shutdown();
    vi.restoreAllMocks();
    context.disable();
    propagation.disable();
  });

  it("a_document_compiles_to_its_manifest_and_program_fingerprint", async () => {
    const compilation = await client.compile(waiting, [], {});

    expect(compilation).toMatchObject({
      kind: "compiled",
      manifest: { identity: { name: "pause", dsl: "1.1.0" }, schedules: [] },
      fingerprint: expect.any(String) as unknown,
    });
  });

  it("checks_beyond_the_check_threads_wait_in_the_queue_instead_of_being_refused", async () => {
    const calls = THREADS.checks * 3;
    const compilations = Array.from({ length: calls }, () =>
      client.compile(waiting, [], {}),
    );

    const compiled = await Promise.all(compilations);

    expect(compiled.map((compilation) => compilation.kind)).toEqual(
      Array<string>(calls).fill("compiled"),
    );
  });

  it("a_document_with_a_defect_is_refused_with_its_pointer", async () => {
    const broken = { ...waiting, do: [{ pause: { wait: "never" } }] };

    const compilation = await client.compile(broken, [], {});

    expect(compilation).toMatchObject({
      kind: "refused",
      diagnostics: [{ pointer: expect.stringMatching(/^\/do\/0/) as unknown }],
    });
  });

  it.each([
    ["authentication.digest", { digest: { username: "u", password: "p" } }],
    [
      "grant.password",
      {
        oauth2: {
          authority: "https://id.example.com",
          grant: "password",
          client: { id: "crm", secret: "s" },
          username: "u",
          password: "p",
        },
      },
    ],
  ])(
    "a_document_needing_%s_is_refused_as_a_capability_the_host_lacks",
    async (capability, authentication) => {
      const document = fetchingWith(authentication);

      const compilation = await client.compile(document, [], {});

      expect(compilation).toMatchObject({
        kind: "refused",
        diagnostics: [
          {
            code: "capability",
            message: `The host does not provide '${capability}'.`,
          },
        ],
      });
    },
  );

  it("a_run_is_started_and_answered_by_effect_id_across_threads", async () => {
    const call = callOf("version-answered");
    const started = await client.start(
      call,
      {},
      {
        ...moment,
        instance: "instance-1",
      },
    );
    const [timer] = started.step.requested;
    const response = { id: timer?.id ?? "", outcome: { kind: "elapsed" } };
    const due = { ...moment, now: moment.now + 30_000 };

    const answered = await client.respond(
      call,
      started.step.state,
      response as never,
      due,
    );

    expect(started.step.status).toBe("running");
    expect(timer).toMatchObject({ kind: "timer" });
    expect(answered).toMatchObject({
      kind: "played",
      step: { status: "completed", output: { done: true } },
    });
  });

  it("a_program_no_thread_holds_is_rebuilt_once_from_its_source", async () => {
    const call = callOf("version-rebuilt");
    const before = sources;

    await client.start(call, {}, { ...moment, instance: "instance-2" });
    await client.start(call, {}, { ...moment, instance: "instance-3" });

    expect(sources - before).toBeLessThanOrEqual(THREADS.runs);
    expect(sources - before).toBeGreaterThanOrEqual(1);
  });

  it("a_call_with_a_state_another_build_made_is_answered_as_incompatible", async () => {
    const started = await client.start(
      callOf("version-incompatible"),
      {},
      { ...moment, instance: "instance-4" },
    );
    const elsewhere = callOf("version-incompatible", "another-build");

    const answered = await client.suspend(
      elsewhere,
      started.step.state,
      moment,
    );

    expect(answered).toEqual({ kind: "incompatible" });
  });

  it("a_state_that_is_no_state_arrives_as_the_interpreters_refusal", async () => {
    const call = callOf("version-faulted");
    const broken = { blob: "no state" } as unknown as State;

    const answered = client.suspend(call, broken, moment);

    await expect(answered).rejects.toThrow("The interpreter refused the call");
  });

  it("a_compilation_out_of_time_is_answered_as_expired", async () => {
    const timeout = new ResilienceTimeoutError(7_000, "interpreter-checks");
    run.mockRejectedValueOnce(timeout);

    const compilation = await client.compile(waiting, [], {});

    expect(compilation).toEqual({ kind: "expired" });
  });

  it("a_call_carries_its_callers_trace_context_to_the_thread", async () => {
    const caller = {
      traceId: TRACE_ID,
      spanId: CALLER_ID,
      traceFlags: TraceFlags.SAMPLED,
    };
    const traced = trace.setSpanContext(ROOT_CONTEXT, caller);
    const traceparent = `00-${TRACE_ID}-${CALLER_ID}-01`;

    await context.with(traced, () => client.compile(waiting, [], {}));

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ pool: "checks", trace: { traceparent } }),
      expect.objectContaining({ name: "compile" }),
    );
  });

  it("a_version_structure_is_read_once_and_kept", async () => {
    const source = { document: waiting, imports: {}, secrets: [] };

    const first = await client.structureOf("version-structured", source);
    const again = await client.structureOf("version-structured", source);

    expect(first).toMatchObject({ namespace: "sales", name: "pause" });
    expect(again).toEqual(first);
    expect(run).toHaveBeenCalledOnce();
  });

  it("the_queue_of_each_pool_is_observed_under_its_name", async () => {
    const observe = vi.fn();
    const observeQueues = gauges.get("tenon.interpreter.pool.queue.length");
    const result = { observe };

    await observeQueues?.(result);

    expect(observe).toHaveBeenCalledWith(0, {
      "tenon.interpreter.pool": "runs",
    });
    expect(observe).toHaveBeenCalledWith(0, {
      "tenon.interpreter.pool": "checks",
    });
  });
});
