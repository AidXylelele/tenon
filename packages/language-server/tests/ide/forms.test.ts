import type { HostProfile, JsonObject } from "interpreter/front-end";
import { expect, test } from "vitest";
import {
  type FormField,
  formOf,
  workflowFormOf,
} from "../../src/ide/forms/index.js";
import type { SchemasAt } from "../../src/ide/places/index.js";
import { yamlOf } from "../../src/ide/yaml-text/index.js";
import { analyzer, profile } from "../support/analyzer.js";
import { inlineHeader } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

const created = await analyzer;

const schemasAt: SchemasAt = (document, pointer) =>
  created.schemasAt(document, pointer);

const paused = `${inlineHeader}do:
  - pause:
      wait: PT1S
      then: route
  - route:
      set:
        a: 1
`;

function check(text: string, step: string) {
  const snapshot = snapshotOf(text);

  return formOf(snapshot, step, schemasAt);
}

function fieldsOf(text: string, step: string): readonly FormField[] {
  const reading = check(text, step);

  if (reading.kind !== "form") {
    throw new Error(reading.reason);
  }

  return reading.fields;
}

function fieldOf(
  fields: readonly FormField[],
  key: string,
): FormField | undefined {
  return fields.find((field) => field.key === key);
}

test("a step's fields come in the grammar's order", () => {
  const fields = fieldsOf(paused, "/do/pause");

  const keys = fields.map((field) => field.key);

  expect(keys).toEqual([
    "if",
    "input",
    "output",
    "export",
    "timeout",
    "then",
    "metadata",
    "wait",
  ]);
});

test("a duration is a field of units, its amounts read from the ISO text", () => {
  const fields = fieldsOf(paused, "/do/pause");
  const wait = fieldOf(fields, "wait");

  const units = wait?.fields.map((field) => [
    field.key,
    field.input,
    field.value,
  ]);

  expect(wait).toMatchObject({
    key: "wait",
    pointer: "/do/0/pause/wait",
    description: "The amount of time to wait.",
    input: "duration",
    required: true,
    written: true,
    value: "PT1S",
  });
  expect(units).toEqual([
    ["days", "number", null],
    ["hours", "number", null],
    ["minutes", "number", null],
    ["seconds", "number", 1],
    ["milliseconds", "number", null],
  ]);
});

test("a then suggests the flow directives and the names of its list", () => {
  const fields = fieldsOf(paused, "/do/pause");

  const then = fieldOf(fields, "then");

  expect(then).toEqual({
    key: "then",
    title: "Then go to",
    pointer: "/do/0/pause/then",
    section: "settings",
    description:
      "The flow directive to be performed upon completion of the task.",
    input: "text",
    choices: ["continue", "exit", "end", "pause", "route"],
    required: false,
    written: true,
    value: "route",
    essentialRank: null,
    fields: [],
    diagnostics: [],
  });
});

test("a member not written is a field with no value", () => {
  const fields = fieldsOf(paused, "/do/pause");

  const condition = fieldOf(fields, "if");

  expect(condition).toEqual({
    key: "if",
    title: "Run only if",
    pointer: "/do/0/pause/if",
    section: "settings",
    description:
      "A runtime expression, if any, used to determine whether or not the task should be run.",
    input: "text",
    choices: [],
    required: false,
    written: false,
    value: null,
    essentialRank: null,
    fields: [],
    diagnostics: [],
  });
});

test("an object of named members is a group of fields in its section", () => {
  const fields = fieldsOf(paused, "/do/pause");

  const input = fieldOf(fields, "input");

  const members = input?.fields.map((field) => [field.key, field.section]);
  expect(input?.input).toBe("group");
  expect(members).toEqual([
    ["schema", "data"],
    ["from", "data"],
  ]);
});

test("the shared members fall into settings, data, failure and note", () => {
  const fields = fieldsOf(paused, "/do/pause");

  const sections = fields.map((field) => [field.key, field.section]);

  expect(sections).toEqual([
    ["if", "settings"],
    ["input", "data"],
    ["output", "data"],
    ["export", "data"],
    ["timeout", "failure"],
    ["then", "settings"],
    ["metadata", "note"],
    ["wait", "settings"],
  ]);
});

test("a field carries the diagnostics at its pointer", () => {
  const text = paused.replace("then: route", "then: nowhere");
  const fields = fieldsOf(text, "/do/pause");

  const then = fieldOf(fields, "then");

  expect(then?.diagnostics).toMatchObject([
    { code: "unknown-task", pointer: "/do/0/pause/then" },
  ]);
});

test("an unknown step is refused", () => {
  const reading = check(paused, "/do/nowhere");

  expect(reading).toEqual({
    kind: "refused",
    reason: "No step has the id '/do/nowhere'.",
  });
});

test("a document that never analysed has no step form", () => {
  const text = paused.replace("wait: PT1S", "wait: PT1S\n      nope: 1");

  const reading = check(text, "/do/pause");

  expect(reading).toEqual({
    kind: "refused",
    reason: "The document has never analysed; edit it in the text.",
  });
});

test("a value that is not a duration is a diagnostic at its field of the version it reads", () => {
  const text = paused.replace("wait: PT1S", "wait: 1 minute");
  const snapshot = snapshotOf(text);

  const reading = formOf(snapshot, "/do/pause", schemasAt);
  const fields = reading.kind === "form" ? reading.fields : [];
  const wait = fieldOf(fields, "wait");

  const codes = wait?.diagnostics.map((diagnostic) => diagnostic.code);
  expect(reading.kind).toBe("form");
  expect(wait?.value).toBe("1 minute");
  expect(codes).toEqual(["schema"]);
});

const protectedGreet = `${inlineHeader}do:
  - greet:
      try:
        - greet: { set: { x: 1 } }
      catch:
        retry: { delay: { seconds: 5 }, limit: { attempt: { count: 3 } } }
`;

test.each([
  ["a step with no protection stops", paused, "/do/pause", "stop"],
  ["a protected step retries", protectedGreet, "/do/greet", "retry"],
])("%s", (_, text, step, failure) => {
  const reading = check(text, step);

  expect(reading).toMatchObject({ kind: "form", failure });
});

test("a protected step's catch is in the failure section", () => {
  const fields = fieldsOf(protectedGreet, "/do/greet");

  const caught = fieldOf(fields, "catch");

  expect(caught?.section).toBe("failure");
});

const fetching = `${inlineHeader}do:
  - fetch:
      call: http
      with:
        method: get
        endpoint: https://example.com
        output: raw
`;

test("a field is titled for people, and the call is described by its task", () => {
  const fields = fieldsOf(fetching, "/do/fetch");
  const withFields = fieldOf(fields, "with")?.fields ?? [];

  const call = fieldOf(fields, "call");
  const titles = withFields.map((field) => field.title);

  expect(call).toMatchObject({
    title: "Kind of call",
    description: "Defines the HTTP call to perform.",
  });
  expect(titles).toContain("Output");
});

test("a place that admits only the values it lists is a choice", () => {
  const fields = fieldsOf(fetching, "/do/fetch");
  const withFields = fieldOf(fields, "with")?.fields ?? [];

  const output = fieldOf(withFields, "output");

  expect(output).toMatchObject({
    input: "choice",
    choices: ["raw", "content", "response"],
    value: "raw",
  });
});

const startedFlow = `document:
  dsl: '1.1.0'
  namespace: test
  name: flow
  version: '0.1.0'
  title: Orders
schedule:
  every: PT1H
do:
  - a: { set: { x: 1 } }
`;

const oneTrigger: HostProfile = { ...profile, triggers: "one" };

function workflowFieldsOf(
  text: string,
  host: HostProfile = profile,
): readonly FormField[] {
  const snapshot = snapshotOf(text);
  const reads = { schemasAt, profile: host };
  const reading = workflowFormOf(snapshot, reads);

  if (reading.kind !== "form") {
    throw new Error(reading.reason);
  }

  return reading.fields;
}

test("the workflow's form holds its header and how it starts", () => {
  const fields = workflowFieldsOf(startedFlow);

  const sections = fields.map((field) => [field.pointer, field.section]);

  expect(sections).toEqual([
    ["/document/title", "note"],
    ["/document/summary", "note"],
    ["/document/version", "settings"],
    ["/schedule", "settings"],
    ["/input", "data"],
  ]);
});

test("a host that runs one trigger offers the schedule as one choice", () => {
  const fields = workflowFieldsOf(startedFlow, oneTrigger);
  const schedule = fieldOf(fields, "schedule");

  const alternatives = schedule?.fields.map((field) => [
    field.key,
    field.input,
    field.value,
  ]);

  expect(schedule?.input).toBe("oneOf");
  expect(alternatives).toEqual([
    ["every", "duration", "PT1H"],
    ["cron", "text", null],
    ["after", "duration", null],
    ["on", "group", null],
  ]);
});

test("the schedule is otherwise a group of the triggers the host runs", () => {
  const host: HostProfile = { ...profile, schedules: ["every", "cron"] };
  const fields = workflowFieldsOf(startedFlow, host);
  const schedule = fieldOf(fields, "schedule");

  const triggers = schedule?.fields.map((field) => field.key);

  expect(schedule?.input).toBe("group");
  expect(triggers).toEqual(["every", "cron"]);
});

test("a trigger's duration written as an object holds its amounts", () => {
  const text = startedFlow.replace("every: PT1H", "every: { minutes: 15 }");
  const fields = workflowFieldsOf(text);
  const every = fieldOf(fields, "schedule")?.fields[0];

  const members = every?.fields.map((field) => [
    field.key,
    field.input,
    field.value,
  ]);

  expect(every?.input).toBe("duration");
  expect(members).toEqual([
    ["days", "number", null],
    ["hours", "number", null],
    ["minutes", "number", 15],
    ["seconds", "number", null],
    ["milliseconds", "number", null],
  ]);
});

test("how events are read is offered only where events start the workflow", () => {
  const onEvents = startedFlow.replace(
    "every: PT1H",
    "on: { one: { with: { type: com.example.paid } } }",
  );
  const withEvents = workflowFieldsOf(onEvents);
  const withoutEvents = workflowFieldsOf(startedFlow);

  const offered = withEvents.map((field) => field.pointer);
  const unoffered = withoutEvents.map((field) => field.pointer);

  expect(offered).toContain("/schedule/read");
  expect(unoffered).not.toContain("/schedule/read");
});

test("a trigger's duration that is not one is a diagnostic at its field", () => {
  const text = startedFlow.replace("every: PT1H", "every: 1 minute");
  const fields = workflowFieldsOf(text);
  const every = fieldOf(fields, "schedule")?.fields[0];

  const codes = every?.diagnostics.map((diagnostic) => diagnostic.code);

  expect(every?.input).toBe("duration");
  expect(codes).toEqual(["schema"]);
});

test("a text that does not read has no workflow form", () => {
  const snapshot = snapshotOf("do: [\n");
  const reads = { schemasAt, profile };

  const reading = workflowFormOf(snapshot, reads);

  expect(reading).toEqual({
    kind: "refused",
    reason: "The text does not read; edit it in the text.",
  });
});

function textHolding(step: JsonObject): string {
  const header = {
    dsl: "1.1.0",
    namespace: "test",
    name: "flow",
    version: "0.1.0",
  };
  const document = { document: header, do: [{ step }] };

  return yamlOf(document);
}

function essentialsOf(fields: readonly FormField[]): readonly string[] {
  const placed = flattenedOf(fields).filter(
    (field) => field.essentialRank !== null,
  );
  const ranked = placed.toSorted(
    (one, other) => (one.essentialRank ?? 0) - (other.essentialRank ?? 0),
  );

  return ranked.map((field) => field.pointer);
}

function flattenedOf(fields: readonly FormField[]): readonly FormField[] {
  return fields.flatMap((field) => {
    const below = flattenedOf(field.fields);
    return [field, ...below];
  });
}

const address = "https://api.test";

test.each<readonly [string, JsonObject, readonly string[]]>([
  [
    "an HTTP GET: its method and address",
    { call: "http", with: { method: "get", endpoint: address } },
    ["with/method", "with/endpoint"],
  ],
  [
    "an HTTP POST: its method, address and the body it sends",
    { call: "http", with: { method: "post", endpoint: address } },
    ["with/method", "with/endpoint", "with/body"],
  ],
  [
    "an OpenAPI call: its description, operation and parameters",
    {
      call: "openapi",
      with: { document: { endpoint: address }, operationId: "" },
    },
    ["with/document/endpoint", "with/operationId", "with/parameters"],
  ],
  [
    "a gRPC call: its proto, service, method and arguments",
    {
      call: "grpc",
      with: {
        proto: { endpoint: address },
        service: { name: "", host: "api.test" },
        method: "",
      },
    },
    [
      "with/proto/endpoint",
      "with/service/name",
      "with/service/host",
      "with/method",
      "with/arguments",
    ],
  ],
  [
    "an AsyncAPI call: its document, operation and message",
    {
      call: "asyncapi",
      with: { document: { endpoint: address }, operation: "", message: {} },
    },
    ["with/document/endpoint", "with/operation", "with/message"],
  ],
  [
    "an MCP call: its server and the tool's parameters",
    {
      call: "mcp",
      with: {
        method: "tools/call",
        parameters: { name: "" },
        transport: { http: { endpoint: address } },
      },
    },
    ["with/transport/http/endpoint", "with/parameters"],
  ],
  [
    "an A2A call: its agent and parameters",
    { call: "a2a", with: { method: "message/send", server: address } },
    ["with/server", "with/parameters"],
  ],
  ["a function call: its arguments", { call: "greet", with: {} }, ["with"]],
  [
    "a script: its language, code and the data it gets",
    { run: { script: { language: "js", code: "" } } },
    ["run/script/language", "run/script/code", "run/script/arguments"],
  ],
  [
    "a shell command: the command",
    { run: { shell: { command: "" } } },
    ["run/shell/command"],
  ],
  [
    "a container: its image and command",
    { run: { container: { image: "" } } },
    ["run/container/image", "run/container/command"],
  ],
  [
    "another workflow: which one and its input",
    { run: { workflow: { namespace: "", name: "", version: "" } } },
    [
      "run/workflow/namespace",
      "run/workflow/name",
      "run/workflow/version",
      "run/workflow/input",
    ],
  ],
  ["a group of steps: none", { do: [] }, []],
  [
    "an emit: the event's type and data",
    { emit: { event: { with: { type: "" } } } },
    ["emit/event/with/type", "emit/event/with/data"],
  ],
  [
    "a loop: the list and the item's name",
    { for: { each: "item", in: "${ .items }" }, do: [] },
    ["for/in", "for/each"],
  ],
  [
    "a fork: its branches and how it finishes",
    { fork: { branches: [] } },
    ["fork/branches", "fork/compete"],
  ],
  [
    "a listen: what it waits for",
    { listen: { to: { one: { with: { type: "" } } } } },
    ["listen/to"],
  ],
  [
    "a raise: the error's title and kind",
    { raise: { error: { type: address, status: 400, title: "" } } },
    ["raise/error/title", "raise/error/type", "raise/error/status"],
  ],
  ["a set: the values", { set: { value: "" } }, ["set"]],
  [
    "a switch: the branches",
    { switch: [{ default: { then: "continue" } }] },
    ["switch"],
  ],
  [
    "a try: the retry and the steps that handle the failure",
    { try: [], catch: {} },
    ["catch/retry", "catch/do"],
  ],
  ["a wait: the duration", { wait: "PT30M" }, ["wait"]],
])("the essential fields of %s, in their order", (_, step, paths) => {
  const text = textHolding(step);
  const fields = fieldsOf(text, "/do/step");

  const essentials = essentialsOf(fields);

  const expected = paths.map((path) => `/do/0/step/${path}`);
  expect(essentials).toEqual(expected);
});

test("a group that holds an essential field below the second level is opened to it", () => {
  const text = textHolding({ run: { script: { language: "js", code: "" } } });
  const fields = fieldsOf(text, "/do/step");
  const run = fieldOf(fields, "run");

  const script = fieldOf(run?.fields ?? [], "script");

  const keys = script?.fields.map((field) => field.key);
  expect(script?.input).toBe("group");
  expect(keys).toEqual([
    "language",
    "stdin",
    "arguments",
    "environment",
    "code",
    "source",
  ]);
});

test("a group that holds no essential field below the second level stays one structured field", () => {
  const text = textHolding({ run: { script: { language: "js", code: "" } } });
  const fields = fieldsOf(text, "/do/step");
  const run = fieldOf(fields, "run");

  const shell = fieldOf(run?.fields ?? [], "shell");

  expect(shell).toMatchObject({ input: "structured", fields: [] });
});

test("the workflow's essential fields are its title and how it starts", () => {
  const snapshot = snapshotOf(paused);
  const reading = workflowFormOf(snapshot, { schemasAt, profile });
  const fields = reading.kind === "form" ? reading.fields : [];

  const essentials = essentialsOf(fields);

  expect(essentials).toEqual(["/document/title", "/schedule"]);
});

const printedChoices = ["printedJson", "printedText", "exitCode"];

const setChoices = ["inputAndValues", "valuesOnly"];

const script = { language: "js", code: "" };

test.each<readonly [string, JsonObject, unknown]>([
  [
    "a script whose output parses what it prints passes on the JSON it prints",
    { run: { script }, output: { as: "${ fromjson }" } },
    { value: "printedJson", choices: printedChoices },
  ],
  [
    "a script with no output transformation passes on the text it prints",
    { run: { script } },
    { value: "printedText", choices: printedChoices },
  ],
  [
    "a script that returns its code passes on its exit code",
    { run: { script, return: "code" } },
    { value: "exitCode", choices: printedChoices },
  ],
  [
    "a script with another output transformation passes on what is written",
    { run: { script }, output: { as: "${ .total }" } },
    { value: "written", choices: printedChoices },
  ],
  [
    "a set that adds its values to its input passes on both",
    { set: { value: "" }, output: { as: "${ $input + . }" } },
    { value: "inputAndValues", choices: setChoices },
  ],
  [
    "a set with no output transformation passes on only its values",
    { set: { value: "" } },
    { value: "valuesOnly", choices: setChoices },
  ],
  ["a wait has no result to choose", { wait: "PT30M" }, null],
])("%s", (_, step, result) => {
  const text = textHolding(step);

  const reading = check(text, "/do/step");

  expect(reading).toMatchObject({ kind: "form", result });
});
