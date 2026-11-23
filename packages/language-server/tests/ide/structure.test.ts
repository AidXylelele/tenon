import type { Range } from "interpreter/front-end";
import { expect, test } from "vitest";
import type { Snapshot } from "../../src/ide/snapshot/index.js";
import {
  type Step,
  type StepList,
  structureReadingOf,
  type WorkflowStructure,
  workflowStructureOf,
} from "../../src/ide/structure/index.js";
import { guardedFlow, inlineHeader } from "../support/documents.js";
import { modelOf, snapshotAfter, snapshotOf } from "../support/snapshot.js";

const rejected = guardedFlow.replace(
  "message: hello",
  "message: hello\n      nope: 1",
);

function check(snapshot: Snapshot) {
  return structureReadingOf(snapshot);
}

function stepsIn(list: StepList): readonly Step[] {
  return list.steps.flatMap((step) => [step, ...step.lists.flatMap(stepsIn)]);
}

function stepNamed(
  workflow: WorkflowStructure,
  name: string,
): Step | undefined {
  const steps = stepsIn(workflow.steps);

  return steps.find((step) => step.name === name);
}

function idsIn(list: StepList): readonly string[] {
  const below = list.steps.flatMap((step) => [
    step.id,
    ...step.lists.flatMap(idsIn),
  ]);

  return [list.id, ...below];
}

function rangesIn(list: StepList): readonly (Range | null)[] {
  const steps = stepsIn(list);

  return steps.flatMap((step) => [step.range, step.selectionRange]);
}

test("the workflow's header and no trigger", () => {
  const snapshot = snapshotOf(guardedFlow);

  const reading = check(snapshot);

  expect(reading).toMatchObject({
    stale: false,
    workflow: { namespace: "test", name: "flow", title: null, triggers: [] },
  });
});

test("a step is its id, kind, family, summary, ranges and flow", () => {
  const snapshot = snapshotOf(guardedFlow);

  const reading = check(snapshot);

  const greet = stepNamed(reading.workflow, "greet");
  expect(greet).toEqual({
    id: "/do/greet",
    pointer: "/do/0/greet",
    name: "greet",
    kind: "set",
    variant: "set",
    family: "data",
    summary: "message",
    milliseconds: null,
    note: null,
    range: { start: { line: 7, column: 3 }, end: { line: 9, column: 23 } },
    selectionRange: {
      start: { line: 7, column: 5 },
      end: { line: 7, column: 10 },
    },
    lists: [],
    flow: [
      {
        on: "done",
        case: null,
        when: null,
        condition: null,
        kind: "next",
        to: "/do/guard",
      },
    ],
    catch: null,
  });
});

test("an HTTP call is summed up by its method and endpoint, and ends its list", () => {
  const snapshot = snapshotOf(guardedFlow);

  const reading = check(snapshot);

  const fetch = stepNamed(reading.workflow, "fetch");
  expect(fetch).toMatchObject({
    summary: "GET https://example.com",
    flow: [{ on: "done", case: null, when: null, kind: "next", to: null }],
  });
});

test("a switch's cases flow before its own then", () => {
  const snapshot = snapshotOf(guardedFlow);

  const reading = check(snapshot);

  const route = stepNamed(reading.workflow, "route");
  expect(route).toMatchObject({
    summary: "2 branches",
    flow: [
      {
        on: "case",
        case: "again",
        when: ".retry",
        kind: "jump",
        to: "/do/guard",
      },
      { on: "case", case: "done", when: null, kind: "end", to: null },
      { on: "done", case: null, when: null, kind: "next", to: null },
    ],
  });
});

test("a catch that writes then flows when caught", () => {
  const text = guardedFlow.replace(
    "      catch:\n        do:",
    "      catch:\n        then: end\n        do:",
  );
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const guard = stepNamed(reading.workflow, "guard");
  expect(guard?.flow).toEqual([
    {
      on: "done",
      case: null,
      when: null,
      condition: null,
      kind: "next",
      to: "/do/route",
    },
    {
      on: "caught",
      case: null,
      when: null,
      condition: null,
      kind: "end",
      to: null,
    },
  ]);
});

test("a step's note is its metadata's note", () => {
  const text = guardedFlow.replace(
    "        message: hello",
    "        message: hello\n      metadata:\n        note: call the vendor first",
  );
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const greet = stepNamed(reading.workflow, "greet");
  expect(greet?.note).toBe("call the vendor first");
});

test("a schedule is a trigger with its duration as written and in milliseconds", () => {
  const text = `${inlineHeader}schedule:
  every: PT1H
do:
  - greet: { set: { a: 1 } }
`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  expect(reading.workflow.triggers).toEqual([
    {
      kind: "every",
      pointer: "/schedule/every",
      summary: "PT1H",
      milliseconds: 3_600_000,
    },
  ]);
});

test("a wait gives its duration in milliseconds, whichever form it is written in", () => {
  const text = `${inlineHeader}do:
  - short: { wait: { minutes: 1, seconds: 30 } }
  - long: { wait: PT2H }
  - computed: { wait: '\${ .delay }' }
`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const amounts = reading.workflow.steps.steps.map((step) => [
    step.name,
    step.milliseconds,
  ]);
  expect(amounts).toEqual([
    ["short", 90_000],
    ["long", 7_200_000],
    ["computed", null],
  ]);
});

test.each([
  [
    "a wait as an object",
    "pause: { wait: { seconds: 30 } }",
    "{ seconds: 30 }",
  ],
  [
    "a loop",
    "loop: { for: { each: item, in: '${ .items }' }, do: [ { one: { set: { a: 1 } } } ] }",
    "item in ${ .items }",
  ],
  [
    "a race",
    "race: { fork: { compete: true, branches: [ { one: { set: { a: 1 } } } ] } }",
    "1 branch, compete",
  ],
  ["a shell", "list: { run: { shell: { command: ls } } }", "shell ls"],
  [
    "an emitted event",
    "send: { emit: { event: { with: { type: com.example.done, source: https://example.com } } } }",
    "com.example.done",
  ],
  [
    "a raised error",
    "fail: { raise: { error: { type: https://example.com/errors/x, status: 400 } } }",
    "https://example.com/errors/x",
  ],
  ["a group", "group: { do: [ { one: { set: { a: 1 } } } ] }", null],
  [
    "an HTTP call with no address yet",
    'fetch: { call: http, with: { method: get, endpoint: "" } }',
    "GET",
  ],
  [
    "a gRPC call with only its method",
    'ask: { call: grpc, with: { proto: { endpoint: "https://api.test/a.proto" }, service: { name: "", host: api.test }, method: Ask } }',
    "Ask",
  ],
  [
    "an OpenAPI call with no operation yet",
    'op: { call: openapi, with: { document: { endpoint: "https://api.test/openapi.yaml" }, operationId: "" } }',
    null,
  ],
  [
    "a container with no image yet",
    'box: { run: { container: { image: "" } } }',
    "container",
  ],
  [
    "a loop with no list yet",
    'loop: { for: { each: item, in: "" }, do: [] }',
    "item",
  ],
  [
    "an emitted event with no type yet",
    'send: { emit: { event: { with: { type: "" } } } }',
    null,
  ],
  [
    "a listen with no event type yet",
    'hear: { listen: { to: { one: { with: { type: "" } } } } }',
    null,
  ],
])("%s is summed up as written", (_, step, summary) => {
  const text = `${inlineHeader}do:\n  - ${step}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.summary).toBe(summary);
});

test("ids are unique, steps and lists together", () => {
  const text = `${inlineHeader}do:
  - do: { do: [ { a: { set: { x: 1 } } } ] }
  - do: { do: [ { a: { set: { x: 1 } } } ] }
  - "1": { do: [ { b: { set: { x: 2 } } } ] }
`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const ids = idsIn(reading.workflow.steps);
  expect(ids).toEqual([
    "/do",
    "/do/do",
    "/do/do/do",
    "/do/do/do/a",
    "#/do/1/do",
    "#/do/1/do/do",
    "#/do/1/do/do/0/a",
    "/do/1",
    "/do/1/do",
    "/do/1/do/b",
  ]);
});

test("a text the grammar refuses keeps the last steps, stale, re-located", () => {
  const snapshot = snapshotAfter(guardedFlow, rejected);

  const reading = check(snapshot);

  const greet = stepNamed(reading.workflow, "greet");
  const route = stepNamed(reading.workflow, "route");
  expect(reading).toMatchObject({ stale: true });
  expect(greet?.range).toEqual({
    start: { line: 7, column: 3 },
    end: { line: 10, column: 14 },
  });
  expect(route?.selectionRange).toEqual({
    start: { line: 23, column: 5 },
    end: { line: 23, column: 10 },
  });
});

test("a text that does not read keeps the last steps with no range", () => {
  const snapshot = snapshotAfter(guardedFlow, "do: [\n");

  const reading = check(snapshot);

  const ranges = rangesIn(reading.workflow.steps);
  const ids = idsIn(reading.workflow.steps);
  expect(reading).toMatchObject({ stale: true });
  expect(ids).toHaveLength(8);
  expect(new Set(ranges)).toEqual(new Set([null]));
});

test("a text that never analysed has an empty structure", () => {
  const snapshot = snapshotOf("do: [\n");

  const reading = check(snapshot);

  expect(reading).toEqual({
    stale: true,
    workflow: {
      namespace: null,
      name: null,
      title: null,
      triggers: [],
      steps: { id: "/do", pointer: "/do", role: "sequence", steps: [] },
    },
  });
});

test("a document given as a value has no range", () => {
  const model = modelOf(guardedFlow);

  const workflow = workflowStructureOf(model, null);

  const ranges = rangesIn(workflow.steps);
  expect(ranges).toHaveLength(10);
  expect(new Set(ranges)).toEqual(new Set([null]));
});

test("a step after a surrogate pair is placed in UTF-16 units", () => {
  const text = `${inlineHeader}do: [ { a: { set: { x: '𐐀' } } }, { b: { set: { y: 1 } } } ]\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const selections = reading.workflow.steps.steps.map(
    (step) => step.selectionRange,
  );
  expect(selections).toEqual([
    { start: { line: 2, column: 9 }, end: { line: 2, column: 10 } },
    { start: { line: 2, column: 38 }, end: { line: 2, column: 39 } },
  ]);
});

test("a fork's branches are a list of role branches", () => {
  const text = `${inlineHeader}do:\n  - race: { fork: { branches: [ { one: { set: { a: 1 } } } ] } }\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const lists = reading.workflow.steps.steps[0]?.lists.map((list) => [
    list.id,
    list.part,
    list.role,
  ]);
  expect(lists).toEqual([["/do/race/fork/branches", "branches", "branches"]]);
});

test.each([
  [
    "an HTTP call",
    "fetch: { call: http, with: { method: get, endpoint: https://api.test } }",
    "http",
  ],
  [
    "a JavaScript script",
    "code: { run: { script: { language: js, code: x } } }",
    "script-js",
  ],
  [
    "a Python script",
    "code: { run: { script: { language: python, code: x } } }",
    "script-python",
  ],
  ["a shell command", "list: { run: { shell: { command: ls } } }", "shell"],
  ["a wait", "pause: { wait: PT1S }", "wait"],
  ["a call of a function", "hello: { call: greet }", null],
])("%s carries its catalog variant", (_, step, variant) => {
  const functions =
    "use:\n  functions:\n    greet:\n      set:\n        a: 1\n";
  const text = `${inlineHeader}${functions}do:\n  - ${step}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.variant).toBe(variant);
});

const tried =
  "[ { fetch: { call: http, with: { method: get, endpoint: https://api.test } } } ]";

const growingRetry =
  "{ delay: { seconds: 2 }, backoff: { exponential: {} }, limit: { attempt: { count: 3 } } }";

test.each([
  [
    "a retry with nothing after it retries, then stops",
    `guard: { try: ${tried}, catch: { retry: ${growingRetry} } }`,
    {
      errors: null,
      when: null,
      exceptWhen: null,
      retry: {
        retries: 3,
        milliseconds: 2000,
        backoff: "exponential",
        when: null,
        exceptWhen: null,
        on: { kind: "any" },
      },
      afterward: "stop",
    },
  ],
  [
    "a retry on one status with steps after it runs them when the retries are spent",
    `guard: { try: ${tried}, catch: { errors: { with: { status: 503 } }, retry: ${growingRetry}, do: [ { note: { set: { failed: true } } } ] } }`,
    {
      errors: {
        type: null,
        status: 503,
        instance: null,
        title: null,
        detail: null,
      },
      when: null,
      exceptWhen: null,
      retry: {
        retries: 3,
        milliseconds: 2000,
        backoff: "exponential",
        when: null,
        exceptWhen: null,
        on: { kind: "any" },
      },
      afterward: "handle",
    },
  ],
  [
    "a catch of one error type with no retry goes on",
    `guard: { try: ${tried}, catch: { errors: { with: { type: https://open-workflow-specification.org/spec/1.0.0/errors/communication } } } }`,
    {
      errors: {
        type: "https://open-workflow-specification.org/spec/1.0.0/errors/communication",
        status: null,
        instance: null,
        title: null,
        detail: null,
      },
      when: null,
      exceptWhen: null,
      retry: null,
      afterward: "continue",
    },
  ],
  [
    "a catch with steps and no retry runs them at once",
    `guard: { try: ${tried}, catch: { when: '\${ .status > 499 }', do: [ { note: { set: { failed: true } } } ] } }`,
    {
      errors: null,
      when: ".status > 499",
      exceptWhen: null,
      retry: null,
      afterward: "handle",
    },
  ],
  [
    "a retry with a then and no steps goes on once the retries are spent",
    `guard: { try: ${tried}, catch: { retry: ${growingRetry}, then: end } }`,
    {
      errors: null,
      when: null,
      exceptWhen: null,
      retry: {
        retries: 3,
        milliseconds: 2000,
        backoff: "exponential",
        when: null,
        exceptWhen: null,
        on: { kind: "any" },
      },
      afterward: "continue",
    },
  ],
  [
    "a retry with no delay retries at once, and without a count retries with no count",
    `guard: { try: ${tried}, catch: { retry: { backoff: { constant: {} }, limit: { duration: { minutes: 5 } } } } }`,
    {
      errors: null,
      when: null,
      exceptWhen: null,
      retry: {
        retries: null,
        milliseconds: 0,
        backoff: "constant",
        when: null,
        exceptWhen: null,
        on: { kind: "any" },
      },
      afterward: "stop",
    },
  ],
])("a try's catch is data: %s", (_, step, policy) => {
  const text = `${inlineHeader}do:\n  - ${step}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.catch).toEqual(policy);
});

test("a retry named among the workflow's components is read from there", () => {
  const retries = `use:\n  retries:\n    patient: ${growingRetry}\n`;
  const text = `${inlineHeader}${retries}do:\n  - guard: { try: ${tried}, catch: { retry: patient } }\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.catch?.retry).toEqual({
    retries: 3,
    milliseconds: 2000,
    backoff: "exponential",
    when: null,
    exceptWhen: null,
    on: { kind: "any" },
  });
});

test("a step that is not a try has no catch", () => {
  const text = `${inlineHeader}do:\n  - pause: { wait: PT1S }\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.catch).toBeNull();
});

const routes = `route: { switch: [ { paid: { when: '\${ .status == "paid" }', then: continue } }, { odd: { when: '\${ .name | test("x") }', then: continue } }, { fresh: { when: "", then: continue } }, { default: { then: end } } ] }`;

test("each case of a switch carries its condition as rows, or its text where the builder cannot show it", () => {
  const text = `${inlineHeader}do:\n  - ${routes}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  const conditions = first?.flow.map((way) => [way.case, way.condition]);
  expect(conditions).toEqual([
    [
      "paid",
      {
        kind: "condition",
        condition: {
          join: "all",
          rows: [
            {
              left: ".status",
              comparison: "is",
              right: { kind: "value", value: "paid" },
            },
          ],
        },
      },
    ],
    ["odd", { kind: "expression", text: '${ .name | test("x") }' }],
    ["fresh", { kind: "condition", condition: { join: "all", rows: [] } }],
    ["default", null],
    [null, null],
  ]);
});

const timeoutType =
  "https://open-workflow-specification.org/spec/1.0.0/errors/timeout";

test.each([
  ["no condition retries any error", "retry: {}", { kind: "any" }],
  [
    "a status retries that status",
    "retry: { when: '${ $error.status == 503 }' }",
    { kind: "statuses", statuses: [503] },
  ],
  [
    "statuses joined by or retry those statuses",
    "retry: { when: '${ ($error.status == 503) or ($error.status == 429) }' }",
    { kind: "statuses", statuses: [503, 429] },
  ],
  [
    "the timeout type retries the time-outs",
    `retry: { when: '\${ $error.type == "${timeoutType}" }' }`,
    { kind: "timeouts" },
  ],
  [
    "a status the catch names otherwise is read under its name",
    "as: failure, retry: { when: '${ $failure.status == 503 }' }",
    { kind: "statuses", statuses: [503] },
  ],
  [
    "statuses joined by and are written conditions",
    "retry: { when: '${ ($error.status == 503) and ($error.status == 429) }' }",
    { kind: "written" },
  ],
  [
    "another condition is written",
    "retry: { when: '${ .attempt < 2 }' }",
    { kind: "written" },
  ],
  [
    "an exception is written",
    "retry: { exceptWhen: '${ $error.status == 404 }' }",
    { kind: "written" },
  ],
])("which errors a retry retries: %s", (_, caught, on) => {
  const step = `guard: { try: ${tried}, catch: { ${caught} } }`;
  const text = `${inlineHeader}do:\n  - ${step}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.catch?.retry?.on).toEqual(on);
});

test("an ISO delay is read as its milliseconds", () => {
  const step = `guard: { try: ${tried}, catch: { retry: { delay: PT2S } } }`;
  const text = `${inlineHeader}do:\n  - ${step}\n`;
  const snapshot = snapshotOf(text);

  const reading = check(snapshot);

  const [first] = reading.workflow.steps.steps;
  expect(first?.catch?.retry?.milliseconds).toBe(2000);
});
