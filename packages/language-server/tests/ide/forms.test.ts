import type { HostProfile } from "interpreter/front-end";
import { expect, test } from "vitest";
import {
  type FormField,
  formOf,
  workflowFormOf,
} from "../../src/ide/forms/index.js";
import type { SchemasAt } from "../../src/ide/places/index.js";
import { analyzer, profile } from "../support/analyzer.js";
import { inlineHeader } from "../support/documents.js";
import { snapshotAfter, snapshotOf } from "../support/snapshot.js";

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

test("a value that is not a duration is a diagnostic at its field", () => {
  const text = paused.replace("wait: PT1S", "wait: 1 minute");
  const snapshot = snapshotAfter(paused, text);

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

test("the Start form stands when a trigger's duration is not one", () => {
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
