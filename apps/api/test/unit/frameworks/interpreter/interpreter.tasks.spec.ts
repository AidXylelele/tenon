import { createHash } from "node:crypto";
import {
  context,
  createNoopMeter,
  metrics,
  propagation,
  trace,
} from "@opentelemetry/api";
import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import canonicalize from "canonicalize";
import {
  createInterpreter,
  type Interpreter,
  type JsonObject,
} from "interpreter";
import { HOST_PROFILE } from "../../../../src/frameworks/interpreter/host-profile.js";
import type {
  CompileSource,
  ThreadProgram,
  ThreadTask,
} from "../../../../src/frameworks/interpreter/interfaces.js";
import { InterpreterTasks } from "../../../../src/frameworks/interpreter/interpreter.tasks.js";

type SpanProcessor = NonNullable<
  NodeSDKConfiguration["spanProcessors"]
>[number];
type EndedSpan = Parameters<SpanProcessor["onEnd"]>[0];

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";

const waiting: JsonObject = {
  document: {
    dsl: "1.1.0",
    namespace: "sales",
    name: "pause",
    version: "1.0.0",
  },
  do: [{ pause: { wait: { seconds: 30 } } }],
};

const source: CompileSource = {
  document: waiting,
  profile: HOST_PROFILE,
  imports: {},
};

const started = {
  now: Date.UTC(2026, 0, 1),
  secrets: {},
  runtime: { name: "tenon", version: "0.0.1", metadata: {} },
  instance: "instance-1",
};

const taskOf = <C>(call: C): ThreadTask<C> => ({
  call,
  pool: "runs",
  enqueuedAt: Date.now(),
  trace: {},
});

const startOf = (program: ThreadProgram) =>
  taskOf({ program, input: {}, context: started });

describe("the interpreter tasks in their thread", () => {
  const ended: EndedSpan[] = [];
  const recorder: SpanProcessor = {
    onStart: () => undefined,
    onEnd: (span) => {
      ended.push(span);
    },
    forceFlush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
  const sdk = new NodeSDK({
    autoDetectResources: false,
    instrumentations: [],
    spanProcessors: [recorder],
    metricReaders: [],
    logRecordProcessors: [],
  });
  let interpreter: Interpreter;

  beforeAll(async () => {
    sdk.start();
    interpreter = await createInterpreter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await sdk.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it("a_task_is_interpreted_inside_the_trace_its_caller_sent", () => {
    const tasks = new InterpreterTasks(interpreter);
    const traceparent = `00-${TRACE_ID}-${PARENT_ID}-01`;
    const task = { ...taskOf(source), trace: { traceparent } };

    tasks.compile(task);

    const compiled = ended.find((span) => span.name === "interpreter.compile");
    const spanContext = compiled?.spanContext();
    expect(spanContext?.traceId).toBe(TRACE_ID);
    expect(compiled?.parentSpanContext?.spanId).toBe(PARENT_ID);
  });

  it("a_task_records_the_seconds_it_waited_under_its_pool", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const meter = createNoopMeter();
    const histogram = meter.createHistogram("wait");
    const record = vi.spyOn(histogram, "record");
    const created = vi
      .spyOn(meter, "createHistogram")
      .mockReturnValue(histogram);
    vi.spyOn(metrics, "getMeter").mockReturnValue(meter);
    const tasks = new InterpreterTasks(interpreter);
    const enqueuedAt = Date.now() - 250;
    const task = { ...taskOf({ type: "order.placed" }), enqueuedAt };

    tasks.filter(task);

    expect(created).toHaveBeenCalledWith(
      "tenon.interpreter.pool.wait.duration",
      expect.objectContaining({ unit: "s" }),
    );
    expect(record).toHaveBeenCalledWith(0.25, {
      "tenon.interpreter.pool": "runs",
    });
  });

  it("a_program_task_without_a_source_for_a_version_the_thread_never_kept_is_missing", () => {
    const tasks = new InterpreterTasks(interpreter);
    const program = {
      versionId: "never-kept",
      fingerprint: null,
      source: null,
    };
    const task = startOf(program);

    const answer = tasks.start(task);

    expect(answer).toEqual({ kind: "missing" });
  });

  it("a_program_kept_from_its_source_is_played_again_without_it", () => {
    const tasks = new InterpreterTasks(interpreter);
    const versionId = "kept";
    const compiling = startOf({ versionId, fingerprint: null, source });
    const keeping = startOf({ versionId, fingerprint: null, source: null });
    const first = tasks.start(compiling);

    const again = tasks.start(keeping);

    expect(first).toMatchObject({ kind: "answered" });
    expect(again).toMatchObject({
      kind: "answered",
      value: { step: { status: "running" } },
    });
  });
  it("a_compiled_document_s_digest_is_the_sha_256_of_its_rfc_8785_form", () => {
    const tasks = new InterpreterTasks(interpreter);

    const answer = tasks.compile(taskOf(source));

    const compiled = answer.kind === "answered" ? answer.value : null;
    const document = compiled?.kind === "compiled" ? compiled.document : {};
    const canonical = canonicalize(document) ?? "";
    const digest = createHash("sha256").update(canonical).digest("hex");
    expect(compiled).toMatchObject({ kind: "compiled", digest });
  });

  it("a_document_with_no_canonical_form_is_refused_as_a_syntax_problem", () => {
    const tasks = new InterpreterTasks(interpreter);
    const named = { ...(waiting.document as JsonObject), title: "\ud800" };
    const unpaired = { ...waiting, document: named };
    const unreadable = { ...source, document: unpaired };

    const answer = tasks.compile(taskOf(unreadable));

    const anyMessage: unknown = expect.any(String);
    expect(answer).toEqual({
      kind: "answered",
      value: {
        kind: "refused",
        diagnostics: [
          {
            code: "syntax",
            message: anyMessage,
            pointer: "",
            range: null,
            subject: null,
            import: null,
          },
        ],
      },
    });
  });
});
