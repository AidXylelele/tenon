import { SpanStatusCode } from "@opentelemetry/api";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  type EffectOutcome,
  type Interpreter,
  type Program,
  type StartContext,
  createInterpreter,
} from "../src/index.js";
import { Translator } from "../src/core/index.js";
import { InterpreterError } from "../src/runtime/index.js";
import { fullOptions } from "./support/interpreter.js";
import { TelemetryRecording } from "./support/telemetry.js";

const greeting = `document:
  dsl: '1.1.0'
  namespace: test
  name: telemetry
  version: '0.1.0'
do:
  - greet:
      set:
        greeting: Hello
`;

const unknownTask = `document:
  dsl: '1.1.0'
  namespace: test
  name: telemetry
  version: '0.1.0'
do:
  - greet:
      fly: away
`;

const call = `document:
  dsl: '1.1.0'
  namespace: test
  name: telemetry
  version: '0.1.0'
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/1
`;

const raise = `document:
  dsl: '1.1.0'
  namespace: test
  name: telemetry
  version: '0.1.0'
do:
  - fail:
      raise:
        error:
          type: https://example.com/errors/broken
          status: 500
          title: Broken
`;

const pet: EffectOutcome = {
  kind: "responded",
  request: {
    method: "GET",
    uri: "https://petstore.swagger.io/v2/pet/1",
    headers: {},
  },
  statusCode: 200,
  headers: { "content-type": "application/json" },
  content: { id: 1, name: "Milou" },
  authorization: null,
};

const begun: StartContext = {
  instance: "instance-7",
  now: 1767225600000,
  secrets: {},
  runtime: { name: "interpreter-tests", version: "1.0.0", metadata: {} },
};

const recording = new TelemetryRecording();
let interpreter: Interpreter;

function compiled(source: string): Program {
  const compilation = interpreter.compile(source, fullOptions);

  if (compilation.kind === "refused") {
    throw new Error("The test refused.");
  }

  return compilation.program;
}

function later(seconds: number): StartContext {
  const now = begun.now + seconds * 1_000;

  return { ...begun, now };
}

beforeAll(async () => {
  recording.register();
  interpreter = await createInterpreter();
});

beforeEach(async () => {
  await recording.clear();
});

afterAll(async () => {
  await recording.unregister();
});

describe("compilation telemetry", () => {
  test("compile records the analyze and translate phases of a compiled workflow", async () => {
    interpreter.compile(greeting, fullOptions);

    const compile = recording.spanNamed("interpreter.compile");
    const analyze = recording.spanNamed("interpreter.analyze");
    const translate = recording.spanNamed("interpreter.translate");
    const compileId = compile.spanContext().spanId;
    expect(analyze.parentSpanContext?.spanId).toBe(compileId);
    expect(translate.parentSpanContext?.spanId).toBe(compileId);
    expect(compile.attributes).toEqual({
      "interpreter.compile.subject": "workflow",
      "interpreter.compile.outcome": "compiled",
    });
    expect(analyze.attributes).toEqual({});
    expect(translate.attributes).toEqual({});
    const points = await recording.points("interpreter.compile.duration");
    const attributes = points.map((point) => point.attributes);
    expect(attributes).toEqual([
      {
        "interpreter.compile.subject": "workflow",
        "interpreter.compile.phase": "analyze",
        "interpreter.compile.outcome": "compiled",
      },
      {
        "interpreter.compile.subject": "workflow",
        "interpreter.compile.phase": "translate",
        "interpreter.compile.outcome": "compiled",
      },
    ]);
  });

  test("a refused compile records only the analyze phase, as refused", async () => {
    const compilation = interpreter.compile(unknownTask, fullOptions);

    expect(compilation.kind).toBe("refused");
    const names = recording.spans().map((span) => span.name);
    expect(names.toSorted()).toEqual([
      "interpreter.analyze",
      "interpreter.compile",
    ]);
    const points = await recording.points("interpreter.compile.duration");
    const attributes = points.map((point) => point.attributes);
    expect(attributes).toEqual([
      {
        "interpreter.compile.subject": "workflow",
        "interpreter.compile.phase": "analyze",
        "interpreter.compile.outcome": "refused",
      },
    ]);
  });

  test("a filter compiles with the subject filter", () => {
    const filter = { with: { type: "com.example.ping" } };
    interpreter.filter(filter);

    const compile = recording.spanNamed("interpreter.compile");
    expect(compile.attributes["interpreter.compile.subject"]).toBe("filter");
    expect(compile.attributes["interpreter.compile.outcome"]).toBe("compiled");
  });

  test("a compile that throws ends its spans in error, records the exception and rethrows", async () => {
    const broken = new InterpreterError("The translation broke.");
    const translating = vi
      .spyOn(Translator.prototype, "translate")
      .mockImplementation(() => {
        throw broken;
      });

    const compiling = () => interpreter.compile(greeting, fullOptions);

    expect(compiling).toThrow(broken);
    translating.mockRestore();
    const compile = recording.spanNamed("interpreter.compile");
    const translate = recording.spanNamed("interpreter.translate");
    expect(compile.status.code).toBe(SpanStatusCode.ERROR);
    expect(translate.status.code).toBe(SpanStatusCode.ERROR);
    expect(compile.attributes["error.type"]).toBe("InterpreterError");
    const recorded = translate.events.map((event) => event.name);
    expect(recorded).toEqual(["exception"]);
    const points = await recording.points("interpreter.compile.duration");
    const types = points.map((point) => point.attributes["error.type"]);
    expect(types).toEqual(["InterpreterError", "InterpreterError"]);
  });

  test("durations are bucketed in seconds, from a tenth of a millisecond", async () => {
    interpreter.compile(greeting, fullOptions);

    const points = await recording.points("interpreter.compile.duration");
    const boundaries = points.map((point) => point.value.buckets.boundaries[0]);
    expect(boundaries).toEqual([0.0001, 0.0001]);
  });
});

describe("program call telemetry", () => {
  test("a call records its span, duration and transitions", async () => {
    const program = compiled(call);
    await recording.clear();

    program.start({}, begun);

    const span = recording.spanNamed("interpreter.start");
    const anyNumber: unknown = expect.any(Number);
    expect(span.attributes).toEqual({
      "interpreter.operation": "start",
      "interpreter.workflow.namespace": "test",
      "interpreter.workflow.name": "telemetry",
      "interpreter.workflow.version": "0.1.0",
      "interpreter.instance.id": "instance-7",
      "interpreter.run.status": "running",
      "interpreter.transitions": anyNumber,
      "interpreter.fibers": 1,
      "interpreter.effects.requested": 1,
      "interpreter.events": anyNumber,
    });
    const transitions = span.attributes["interpreter.transitions"];
    expect(transitions).toBeGreaterThan(0);
    const durations = await recording.points("interpreter.step.duration");
    const attributes = durations.map((point) => point.attributes);
    expect(attributes).toEqual([
      { "interpreter.operation": "start", "interpreter.run.status": "running" },
    ]);
    const counted = await recording.points("interpreter.step.transitions");
    const sums = counted.map((point) => point.value.sum);
    expect(sums).toEqual([transitions]);
  });

  test("the call that ends the run records its lifetime once, after suspensions", async () => {
    const program = compiled(call);
    const response = { id: "/do/0/getPet", outcome: pet };
    await recording.clear();

    const started = program.start({}, begun);
    const suspended = program.suspend(started.state, later(1));
    const resumed = program.resume(suspended.state, later(2));
    const completed = program.respond(resumed.state, response, later(5));

    expect(completed.status).toBe("completed");
    const lifetimes = await recording.points("interpreter.run.duration");
    const recorded = lifetimes.map((point) => ({
      attributes: point.attributes,
      count: point.value.count,
      sum: point.value.sum,
    }));
    expect(recorded).toEqual([
      {
        attributes: { "interpreter.run.status": "completed" },
        count: 1,
        sum: 5,
      },
    ]);
  });

  test("a suspend records the suspended status", async () => {
    const program = compiled(call);
    const started = program.start({}, begun);
    await recording.clear();

    program.suspend(started.state, later(1));

    const durations = await recording.points("interpreter.step.duration");
    const attributes = durations.map((point) => point.attributes);
    expect(attributes).toEqual([
      {
        "interpreter.operation": "suspend",
        "interpreter.run.status": "suspended",
      },
    ]);
  });

  test("a cancelled run records its lifetime as cancelled", async () => {
    const program = compiled(call);
    const started = program.start({}, begun);
    await recording.clear();

    program.cancel(started.state, later(3));

    const lifetimes = await recording.points("interpreter.run.duration");
    const recorded = lifetimes.map((point) => ({
      attributes: point.attributes,
      sum: point.value.sum,
    }));
    expect(recorded).toEqual([
      { attributes: { "interpreter.run.status": "cancelled" }, sum: 3 },
    ]);
  });

  test("a call on an ended run records the error, not a status", async () => {
    const program = compiled(call);
    const response = { id: "/do/0/getPet", outcome: pet };
    const started = program.start({}, begun);
    const completed = program.respond(started.state, response, later(1));
    await recording.clear();

    const responding = () =>
      program.respond(completed.state, response, later(2));

    expect(responding).toThrow(InterpreterError);
    const span = recording.spanNamed("interpreter.respond");
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    const recorded = span.events.map((event) => event.name);
    expect(recorded).toEqual(["exception"]);
    const durations = await recording.points("interpreter.step.duration");
    const attributes = durations.map((point) => point.attributes);
    expect(attributes).toEqual([
      { "interpreter.operation": "respond", "error.type": "InterpreterError" },
    ]);
    const lifetimes = await recording.points("interpreter.run.duration");
    expect(lifetimes).toEqual([]);
  });

  test("a faulted run is an outcome, not an error", async () => {
    const program = compiled(raise);
    await recording.clear();

    const faulted = program.start({}, begun);

    expect(faulted.status).toBe("faulted");
    const span = recording.spanNamed("interpreter.start");
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes["interpreter.run.status"]).toBe("faulted");
    const lifetimes = await recording.points("interpreter.run.duration");
    const statuses = lifetimes.map((point) => point.attributes);
    expect(statuses).toEqual([{ "interpreter.run.status": "faulted" }]);
  });
});
