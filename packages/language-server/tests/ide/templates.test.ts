import { type JsonValue, createInterpreter } from "interpreter";
import { expect, test } from "vitest";
import {
  type TemplatePart,
  templateOf,
  templateTextOf,
} from "../../src/ide/templates/index.js";
import { profile } from "../support/analyzer.js";

const interpreter = await createInterpreter();

const startContext = {
  instance: "instance-1",
  now: 1767225600000,
  secrets: {},
  runtime: { name: "language-server-tests", version: "1.0.0", metadata: {} },
};

const title: TemplatePart = {
  kind: "data",
  expression: ".title",
  label: "title",
};

const digest: readonly TemplatePart[] = [
  { kind: "text", text: "New digest: " },
  title,
];

function textOf(parts: readonly TemplatePart[]): string {
  const written = templateTextOf(parts);

  if (written.kind === "refused") {
    throw new Error(written.reason);
  }

  return written.text;
}

function messageOf(message: string, input: JsonValue): JsonValue {
  const document = {
    document: { dsl: "1.1.0", namespace: "test", name: "t", version: "0.1.0" },
    do: [{ greet: { set: { message } } }],
  };
  const options = { profile, imports: {} };
  const compilation = interpreter.compile(document, options);

  if (compilation.kind === "refused") {
    const diagnostics = JSON.stringify(compilation.diagnostics);
    throw new Error(`The interpreter refused the document: ${diagnostics}`);
  }

  const step = compilation.program.start(input, startContext);

  if (step.status !== "completed") {
    throw new Error(`The run did not complete: ${step.status}`);
  }

  return step.output;
}

test.each<readonly [string, string, readonly TemplatePart[]]>([
  ["an empty text", "", []],
  ["a text alone", "Hello", [{ kind: "text", text: "Hello" }]],
  [
    "a reference written into a text, which is sent as written",
    "New digest: ${ .title }",
    [{ kind: "text", text: "New digest: ${ .title }" }],
  ],
  ["a jq string interpolation", '${ "New digest: \\(.title)" }', digest],
  ["a reference alone", "${ .title }", [title]],
  [
    "a reference by a key",
    '${ "Hi \\(.["first name"])!" }',
    [
      { kind: "text", text: "Hi " },
      { kind: "data", expression: '.["first name"]', label: "first name" },
      { kind: "text", text: "!" },
    ],
  ],
  [
    "a reference to a step through the context",
    '${ "Items: \\($context.fetch.items)" }',
    [
      { kind: "text", text: "Items: " },
      { kind: "data", expression: "$context.fetch.items", label: "items" },
    ],
  ],
  [
    "an embedded expression that is no path, sent as written",
    "Price: ${ 5 }",
    [{ kind: "text", text: "Price: ${ 5 }" }],
  ],
  [
    "escapes in a jq string",
    '${ "a \\"quoted\\" \\\\ line\\n\\(.title)" }',
    [{ kind: "text", text: 'a "quoted" \\ line\n' }, title],
  ],
])("%s is read as parts", (_, text, parts) => {
  const read = templateOf(text);

  expect(read).toEqual({ kind: "template", parts });
});

test.each([
  ["a computation", "${ .count + 1 }"],
  ["a computation in an interpolation", '${ "Total: \\(.a + .b)" }'],
  ["a join of strings", '${ "a" + .b }'],
  ["two expressions in one text", "${ .a } and ${ .b }"],
])("%s is read as an expression", (_, text) => {
  const read = templateOf(text);

  expect(read).toEqual({ kind: "expression", text });
});

test.each<readonly [string, readonly TemplatePart[], string]>([
  ["no part", [], ""],
  ["a text alone", [{ kind: "text", text: "Hello" }], "Hello"],
  ["a reference alone", [title], "${ .title }"],
  ["text and data", digest, '${ "New digest: \\(.title)" }'],
  [
    "a text that looks like an expression",
    [{ kind: "text", text: "costs ${ 5 }" }],
    '${ "costs ${ 5 }" }',
  ],
  [
    "a text with quotes, a backslash and a line break",
    [{ kind: "text", text: 'a "b" \\ \n' }, title],
    '${ "a \\"b\\" \\\\ \\n\\(.title)" }',
  ],
])("a template of %s is written in its one form", (_, parts, text) => {
  const written = templateTextOf(parts);

  expect(written).toEqual({ kind: "text", text });
});

test("a reference that is no path is refused with its reason", () => {
  const parts: readonly TemplatePart[] = [
    { kind: "data", expression: ".a + 1", label: "a" },
  ];

  const written = templateTextOf(parts);

  expect(written).toEqual({
    kind: "refused",
    reason: "'.a + 1' is not a path to data.",
  });
});

test("a written template reads back as its parts", () => {
  const parts: readonly TemplatePart[] = [
    { kind: "text", text: 'Dear "' },
    { kind: "data", expression: "$order.name", label: "name" },
    { kind: "text", text: '", your total is ' },
    { kind: "data", expression: ".total", label: "total" },
  ];
  const text = textOf(parts);

  const read = templateOf(text);

  expect(read).toEqual({ kind: "template", parts });
});

test("the interpreter evaluates the written form into the text with its data", () => {
  const text = textOf(digest);
  const input = { title: "Weekly" };

  const output = messageOf(text, input);

  expect(output).toEqual({ message: "New digest: Weekly" });
});

test("the interpreter writes data that is not text as JSON into the text", () => {
  const parts: readonly TemplatePart[] = [
    { kind: "text", text: "Count: " },
    { kind: "data", expression: ".count", label: "count" },
  ];
  const text = textOf(parts);
  const input = { count: 3 };

  const output = messageOf(text, input);

  expect(output).toEqual({ message: "Count: 3" });
});

test("the interpreter keeps a reference written into a text as plain text", () => {
  const input = { title: "Weekly" };

  const output = messageOf("New digest: ${ .title }", input);

  expect(output).toEqual({ message: "New digest: ${ .title }" });
});
