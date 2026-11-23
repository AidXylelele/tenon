import { Test } from "@nestjs/testing";
import type { Interpreter, JsonObject } from "interpreter";
import { InterpreterThreadModule } from "../../../../src/frameworks/di/interpreter-thread.module.js";
import { HOST_PROFILE } from "../../../../src/frameworks/interpreter/host-profile.js";
import { InterpreterTasks } from "../../../../src/frameworks/interpreter/interpreter.tasks.js";

const greeting: JsonObject = {
  document: {
    dsl: "1.1.0",
    namespace: "sales",
    name: "greet",
    version: "1.0.0",
  },
  do: [{ greet: { set: { greeting: "Hello" } } }],
};

const started = {
  now: Date.UTC(2026, 0, 1),
  secrets: {},
  runtime: { name: "tenon", version: "0.0.1", metadata: {} },
  instance: "instance-1",
};

async function completedTypesOf(): Promise<readonly string[]> {
  const moduleRef = await Test.createTestingModule({
    imports: [InterpreterThreadModule],
  }).compile();
  const interpreter = moduleRef.get<Interpreter>(InterpreterTasks.INTERPRETER);
  const options = { profile: HOST_PROFILE, imports: {} };
  const compilation = interpreter.compile(greeting, options);
  await moduleRef.close();

  if (compilation.kind === "refused")
    throw new Error("The interpreter refused the document");

  const step = compilation.program.start({}, started);
  const completed = step.events.find(
    (event) => event.name === "workflow.completed",
  );
  return completed?.types ?? [];
}

describe("InterpreterThreadModule", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("the_threads_interpreter_types_a_lifecycle_event_by_the_standard_alone_by_default", async () => {
    vi.stubEnv("LEGACY_EVENT_TYPES", undefined);

    const types = await completedTypesOf();

    expect(types).toEqual([
      "org.open-workflow-specification.workflow.completed.v1",
    ]);
  });

  it("the_threads_interpreter_adds_the_legacy_type_when_legacy_event_types_is_true", async () => {
    vi.stubEnv("LEGACY_EVENT_TYPES", "true");

    const types = await completedTypesOf();

    expect(types).toEqual([
      "org.open-workflow-specification.workflow.completed.v1",
      "io.serverlessworkflow.workflow.completed.v1",
    ]);
  });
});
