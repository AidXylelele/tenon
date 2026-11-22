import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceModule } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type { JsonObject, State } from "interpreter";
import { PermanentFault } from "../../../src/domain/errors.js";
import { IncompatibleRun } from "../../../src/interface-adapters/workflows/incompatible-run.error.js";
import { resiliencePresets } from "../../../src/frameworks/di/resilience.presets.js";
import { WorkerInterpreterClient } from "../../../src/frameworks/interpreter/worker-interpreter.client.js";

const waiting: JsonObject = {
  document: {
    dsl: "1.1.0",
    namespace: "sales",
    name: "pause",
    version: "1.0.0",
  },
  do: [{ pause: { wait: { seconds: 30 } } }, { done: { set: { done: true } } }],
};

const context = {
  now: Date.UTC(2026, 0, 1),
  secrets: {},
  runtime: { name: "tenon", version: "0.0.1", metadata: {} },
};

describe("the interpreter in its worker threads", () => {
  let app: INestApplicationContext;
  let client: WorkerInterpreterClient;
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
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
      providers: [WorkerInterpreterClient],
    }).compile();
    app = await moduleRef.init();
    client = app.get(WorkerInterpreterClient);
  });

  afterAll(async () => {
    await app.close();
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
    const calls = WorkerInterpreterClient.CHECK_THREADS * 3;
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

  it("a_run_is_started_and_answered_by_effect_id_across_threads", async () => {
    const call = callOf("version-answered");
    const started = await client.start(
      call,
      {},
      {
        ...context,
        instance: "instance-1",
      },
    );
    const [timer] = started.step.requested;
    const response = { id: timer?.id ?? "", outcome: { kind: "elapsed" } };
    const due = { ...context, now: context.now + 30_000 };

    const answered = await client.respond(
      call,
      started.step.state,
      response as never,
      due,
    );

    expect(started.step.status).toBe("running");
    expect(timer).toMatchObject({ kind: "timer" });
    expect(answered).toMatchObject({
      status: "completed",
      output: { done: true },
    });
  });

  it("a_program_no_thread_holds_is_rebuilt_once_from_its_source", async () => {
    const call = callOf("version-rebuilt");
    const before = sources;

    await client.start(call, {}, { ...context, instance: "instance-2" });
    await client.start(call, {}, { ...context, instance: "instance-3" });

    expect(sources - before).toBeLessThanOrEqual(
      WorkerInterpreterClient.RUN_THREADS,
    );
    expect(sources - before).toBeGreaterThanOrEqual(1);
  });

  it("a_call_with_a_state_another_build_made_is_refused_as_an_incompatible_run", async () => {
    const started = await client.start(
      callOf("version-incompatible"),
      {},
      { ...context, instance: "instance-4" },
    );
    const elsewhere = callOf("version-incompatible", "another-build");

    const answered = client.suspend(elsewhere, started.step.state, context);

    await expect(answered).rejects.toBeInstanceOf(IncompatibleRun);
  });

  it("this_build_rebuilds_the_program_a_run_recorded_and_no_other", async () => {
    const started = await client.start(
      callOf("version-recorded"),
      {},
      { ...context, instance: "instance-5" },
    );
    const recorded = callOf("version-recorded", started.fingerprint);
    const elsewhere = callOf("version-recorded", "another-build");

    expect(await client.rebuilds(recorded)).toBe(true);
    expect(await client.rebuilds(elsewhere)).toBe(false);
  });

  it("a_state_that_is_no_state_arrives_as_a_permanent_fault", async () => {
    const call = callOf("version-faulted");
    const broken = { blob: "no state" } as unknown as State;

    const answered = client.suspend(call, broken, context);

    await expect(answered).rejects.toBeInstanceOf(PermanentFault);
  });
});
