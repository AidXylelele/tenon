import { json } from "jq-wasm";
import { expect, test } from "vitest";
import { dataAtOf } from "../../src/ide/data/index.js";
import { analyzer, profile } from "../support/analyzer.js";
import { inlineHeader } from "../support/documents.js";
import { snapshotAfter, snapshotOf } from "../support/snapshot.js";

const created = await analyzer;

const options = { profile, imports: {} };

const speculate = (text: string) => created.analyze(text, options);

function check(text: string, step: string, field: string) {
  const snapshot = snapshotOf(text);

  return dataAtOf(snapshot, { step, field }, speculate);
}

function entriesOf(text: string, step: string, field: string) {
  const reading = check(text, step, field);

  if (reading.kind === "refused") {
    throw new Error(reading.reason);
  }

  return reading.entries;
}

function entryOf(text: string, step: string, field: string, name: string) {
  const entries = entriesOf(text, step, field);

  return entries.find((entry) => entry.name === name);
}

const reportFlow = `${inlineHeader}use:
  secrets: [ apiToken ]
input:
  schema:
    document:
      type: object
      properties:
        customer: { type: string }
do:
  - fetch:
      call: http
      with: { method: get, endpoint: https://api.test/orders }
  - total:
      set:
        count: 2
        label: orders
  - report:
      call: http
      with:
        method: post
        endpoint: https://api.test/report
        body: {}
`;

const body = "/do/2/report/with/body";

test("the step before reaches as the data the step receives, with the values its set writes", () => {
  const total = entryOf(reportFlow, "/do/report", body, "total");

  expect(total).toEqual({
    source: "step",
    name: "total",
    step: "/do/total",
    expression: ".",
    value: "${ . }",
    shape: "object",
    needsExport: false,
    members: [
      {
        name: "count",
        expression: ".count",
        value: "${ .count }",
        shape: "number",
        members: [],
      },
      {
        name: "label",
        expression: ".label",
        value: "${ .label }",
        shape: "text",
        members: [],
      },
    ],
  });
});

test("a set replaces what flows on, so a step before it reaches only through the context, which picking it exports to", () => {
  const fetch = entryOf(reportFlow, "/do/report", body, "fetch");

  expect(fetch).toEqual({
    source: "step",
    name: "fetch",
    step: "/do/fetch",
    expression: "$context.fetch",
    value: "${ $context.fetch }",
    shape: "unknown",
    needsExport: true,
    members: [],
  });
});

test("the steps before come nearest first, after them the workflow's input and the times", () => {
  const entries = entriesOf(reportFlow, "/do/report", body);

  const names = entries.map((entry) => [entry.source, entry.name]);
  expect(names).toEqual([
    ["step", "total"],
    ["step", "fetch"],
    ["workflowInput", "input"],
    ["time", "now"],
    ["time", "today"],
    ["time", "yesterday"],
  ]);
});

test("the workflow's raw input is offered with the members its schema describes", () => {
  const input = entryOf(reportFlow, "/do/report", body, "input");

  expect(input).toEqual({
    source: "workflowInput",
    name: "input",
    step: null,
    expression: "$workflow.input",
    value: "${ $workflow.input }",
    shape: "object",
    needsExport: false,
    members: [
      {
        name: "customer",
        expression: "$workflow.input.customer",
        value: "${ $workflow.input.customer }",
        shape: "text",
        members: [],
      },
    ],
  });
});

test("the first step of the workflow has no step before it", () => {
  const entries = entriesOf(
    reportFlow,
    "/do/fetch",
    "/do/0/fetch/with/endpoint",
  );

  const steps = entries.filter((entry) => entry.source === "step");
  expect(steps).toEqual([]);
});

test.each([
  [
    "an address",
    "/do/2/report/with/endpoint",
    [["secret", "apiToken", "$secrets.apiToken"]],
  ],
  ["a body", body, []],
])(
  "secrets are offered only where credentials go: in %s",
  (_, field, expected) => {
    const entries = entriesOf(reportFlow, "/do/report", field);

    const secrets = entries
      .filter((entry) => entry.source === "secret")
      .map((entry) => [entry.source, entry.name, entry.expression]);
    expect(secrets).toEqual(expected);
  },
);

const mergeFlow = `${inlineHeader}do:
  - first:
      set:
        a: 1
  - second:
      set:
        b: text
      output:
        as: \${ $input + . }
  - third:
      set:
        c: true
`;

test("a set that keeps its input passes the input's members on beside its values", () => {
  const second = entryOf(mergeFlow, "/do/third", "/do/2/third/set/c", "second");

  const members = second?.members.map((member) => [member.name, member.shape]);
  expect(members).toEqual([
    ["a", "number"],
    ["b", "text"],
  ]);
});

const scriptFlow = `${inlineHeader}do:
  - printed:
      run:
        script:
          language: js
          code: console.log("hi")
  - parsed:
      run:
        script:
          language: js
          code: console.log("{}")
      output:
        as: \${ fromjson }
  - next:
      set:
        x: 1
`;

test("a script's printed result reaches as text, its fields unknown", () => {
  const entries = entriesOf(
    scriptFlow,
    "/do/parsed",
    "/do/1/parsed/run/script/code",
  );

  const printed = entries.find((entry) => entry.name === "printed");
  expect(printed).toMatchObject({
    expression: ".",
    shape: "text",
    members: [],
  });
});

test("a script whose output parses what it prints passes on data whose fields are not known before it runs", () => {
  const parsed = entryOf(scriptFlow, "/do/next", "/do/2/next/set/x", "parsed");

  expect(parsed).toMatchObject({
    expression: ".",
    shape: "unknown",
    members: [],
  });
});

const schemaFlow = `${inlineHeader}do:
  - fetch:
      call: http
      with: { method: get, endpoint: https://api.test/orders }
      output:
        schema:
          document:
            type: object
            properties:
              items: { type: array }
  - post:
      set:
        x: 1
`;

test("an output schema gives the members of a step's output", () => {
  const fetch = entryOf(schemaFlow, "/do/post", "/do/1/post/set/x", "fetch");

  expect(fetch?.members).toEqual([
    {
      name: "items",
      expression: ".items",
      value: "${ .items }",
      shape: "list",
      members: [],
    },
  ]);
});

const transformedFlow = schemaFlow.replace(
  "  - post:\n",
  "  - post:\n      input:\n        from: ${ .items }\n",
);

test.each([
  [
    "its definition receives what its input.from makes",
    "/do/1/post/set/x",
    "$context.fetch",
  ],
  ["its input.from receives the raw input", "/do/1/post/input/from", "."],
])("a step with its own input: %s", (_, field, expression) => {
  const fetch = entryOf(transformedFlow, "/do/post", field, "fetch");

  expect(fetch?.expression).toBe(expression);
});

const jumpedFlow = `${inlineHeader}do:
  - start:
      set:
        a: 1
      then: last
  - middle:
      set:
        b: 2
  - last:
      set:
        c: 3
`;

test("a step entered by a jump receives data from more than one step, so the step before reaches through the context", () => {
  const middle = entryOf(jumpedFlow, "/do/last", "/do/2/last/set/c", "middle");

  expect(middle).toMatchObject({
    expression: "$context.middle",
    needsExport: true,
  });
});

const switchedFlow = `${inlineHeader}do:
  - fetch:
      set:
        items: [ 1 ]
  - route:
      switch:
        - some:
            when: \${ .items != [] }
            then: continue
        - default:
            then: end
  - post:
      set:
        x: 1
`;

test("a step after a switch receives the switch's input, so the step before the switch reaches as its data", () => {
  const entries = entriesOf(switchedFlow, "/do/post", "/do/2/post/set/x");

  const steps = entries
    .filter((entry) => entry.source === "step")
    .map((entry) => [entry.name, entry.expression]);
  expect(steps).toEqual([["fetch", "."]]);
});

const exportedFlow = `${inlineHeader}do:
  - fetch:
      set:
        a: 1
      export:
        as: '\${ $context + { "fetch": . } }'
  - other:
      set:
        b: 2
      export:
        as: '\${ { b: .b } }'
  - between:
      set:
        c: 3
  - last:
      set:
        d: 4
`;

test("an earlier step's own export replaces the context, so it and the steps before it are not offered", () => {
  const entries = entriesOf(exportedFlow, "/do/last", "/do/3/last/set/d");

  const steps = entries
    .filter((entry) => entry.source === "step")
    .map((entry) => [entry.name, entry.expression, entry.needsExport]);
  expect(steps).toEqual([["between", ".", false]]);
});

test("an earlier step already exported under its name reads from the context with no new export", () => {
  const text = exportedFlow.replace(
    "      export:\n        as: '${ { b: .b } }'\n",
    "",
  );

  const fetch = entryOf(text, "/do/last", "/do/3/last/set/d", "fetch");

  expect(fetch).toMatchObject({
    expression: "$context.fetch",
    needsExport: false,
  });
});

const loopFlow = `${inlineHeader}do:
  - each:
      for:
        in: \${ .orders }
        each: order
      do:
        - total:
            set:
              x: 1
`;

test("the variables a loop binds are offered at the steps inside it", () => {
  const entries = entriesOf(
    loopFlow,
    "/do/each/do/total",
    "/do/0/each/do/0/total/set/x",
  );

  const variables = entries
    .filter((entry) => entry.source === "variable")
    .map((entry) => [entry.name, entry.expression]);
  expect(variables).toEqual([
    ["order", "$order"],
    ["index", "$index"],
  ]);
});

test.each([
  ["now", "2025-11-23T12:13:20Z"],
  ["today", "2025-11-23T00:00:00Z"],
  ["yesterday", "2025-11-22T00:00:00Z"],
])(
  "%s is a UTC time jq computes from the run's clock",
  async (name, expected) => {
    const time = entryOf(reportFlow, "/do/report", body, name);
    const expression = time?.expression ?? "";
    const clocked = `def now: 1763900000; ${expression}`;

    const [computed] = await json(null, clocked);

    expect(time).toMatchObject({ source: "time", shape: "text" });
    expect(computed).toBe(expected);
  },
);

const firstMerge = `${inlineHeader}do:
  - keep:
      set:
        a: 1
      output:
        as: \${ $input + . }
`;

test.each([
  [
    "warned where its input is not known to be an object, since jq adds an object only to an object or null",
    firstMerge,
    [{ kind: "inputNotKnownObject", step: "/do/keep" }],
  ],
  [
    "not warned where the workflow's input schema makes it an object",
    firstMerge.replace(
      "do:\n",
      "input:\n  schema:\n    document:\n      type: object\ndo:\n",
    ),
    [],
  ],
])("a set that keeps its input is %s", (_, text, warnings) => {
  const reading = check(text, "/do/keep", "/do/0/keep/set/a");

  expect(reading).toMatchObject({ kind: "data", warnings });
});

test.each([
  ["an unknown step", "/do/nowhere", body, "No step has the id '/do/nowhere'."],
  [
    "a field outside the step",
    "/do/report",
    "/do/0/fetch/with/endpoint",
    "/do/0/fetch/with/endpoint is not a field of the step /do/report.",
  ],
])("the data at %s is refused", (_, step, field, reason) => {
  const reading = check(reportFlow, step, field);

  expect(reading).toEqual({ kind: "refused", reason });
});

test("a text the grammar refuses keeps the data of the last version that analysed", () => {
  const broken = reportFlow.replace(
    "        body: {}\n",
    "        body: {}\n      nope: 1\n",
  );
  const snapshot = snapshotAfter(reportFlow, broken);

  const reading = dataAtOf(
    snapshot,
    { step: "/do/report", field: body },
    speculate,
  );

  expect(reading).toMatchObject({ kind: "data" });
});

test("a text that does not read has no data", () => {
  const reading = check("do: [\n", "/do/report", body);

  expect(reading).toEqual({
    kind: "refused",
    reason: "The text does not read; edit it in the text.",
  });
});
