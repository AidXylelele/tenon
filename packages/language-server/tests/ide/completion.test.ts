import { expect, test } from "vitest";
import { completionsAt } from "../../src/ide/completion/index.js";
import { analyzer, profile } from "../support/analyzer.js";
import {
  countdownFlow,
  guardedFlow,
  inlineHeader,
  orderFlow,
} from "../support/documents.js";
import { fixtureOf } from "../support/fixture.js";

const created = await analyzer;

const reads = {
  schemasAt: created.schemasAt.bind(created),
  profile,
  speculate: (text: string) => created.analyze(text, { profile, imports: {} }),
};

function check(marked: string, host = reads) {
  const { text, cursor } = fixtureOf(marked);

  return completionsAt(text, cursor, host);
}

function directive(name: string) {
  return { label: name, insert: name, kind: "directive", description: null };
}

function name(text: string) {
  return { label: text, insert: text, kind: "name", description: null };
}

function value(text: string) {
  return { label: text, insert: text, kind: "value", description: null };
}

test("a key typed without its colon offers the members not written", () => {
  const marked = guardedFlow.replace(
    "message: hello\n",
    "message: hello\n      wai‸\n",
  );

  const completions = check(marked);

  expect(completions).toEqual({
    range: { start: { line: 10, column: 7 }, end: { line: 10, column: 10 } },
    items: [
      {
        label: "if",
        insert: "if: ",
        kind: "member",
        description:
          "A runtime expression, if any, used to determine whether or not the task should be run.",
      },
      {
        label: "input",
        insert: "input: ",
        kind: "member",
        description: "Configure the task's input.",
      },
      {
        label: "output",
        insert: "output: ",
        kind: "member",
        description: "Configure the task's output.",
      },
      {
        label: "export",
        insert: "export: ",
        kind: "member",
        description: "Export task output to context.",
      },
      {
        label: "timeout",
        insert: "timeout: ",
        kind: "member",
        description: null,
      },
      {
        label: "then",
        insert: "then: ",
        kind: "member",
        description:
          "The flow directive to be performed upon completion of the task.",
      },
      {
        label: "metadata",
        insert: "metadata: ",
        kind: "member",
        description: "Holds additional information about the task.",
      },
    ],
  });
});

test("a then offers the flow directives and the names of its list's tasks", () => {
  const marked = guardedFlow.replace("then: guard", "then: ‸");

  const completions = check(marked);

  expect(completions).toEqual({
    range: { start: { line: 26, column: 19 }, end: { line: 26, column: 19 } },
    items: [
      directive("continue"),
      directive("exit"),
      directive("end"),
      name("greet"),
      name("guard"),
      name("route"),
    ],
  });
});

const withLog = countdownFlow.replace(
  "do:\n",
  "    log:\n      set:\n        logged: true\ndo:\n",
);

const callMarked = withLog.replace(
  "call: countdown\n  - again",
  "call: ‸\n  - again",
);

test("a call offers the call kinds the host runs and the declared functions", () => {
  const completions = check(callMarked);

  const labels = completions.items.map((item) => item.label);
  const http = completions.items.find((item) => item.label === "http");

  expect(labels).toEqual([
    "http",
    "openapi",
    "grpc",
    "asyncapi",
    "a2a",
    "mcp",
    "countdown",
    "log",
  ]);
  expect(http).toEqual({
    label: "http",
    insert: "http",
    kind: "value",
    description: "Defines the HTTP call to perform.",
  });
});

test("a call kind the host does not run is not offered", () => {
  const effects: typeof profile.effects = ["http", "process"];
  const narrow = { ...reads, profile: { ...profile, effects } };

  const completions = check(callMarked, narrow);

  const labels = completions.items.map((item) => item.label);
  expect(labels).toEqual(["http", "countdown", "log"]);
});

test("a value of the grammar's enum offers its values", () => {
  const marked = guardedFlow.replace(
    "endpoint: https://example.com",
    "endpoint: https://example.com\n              output: ‸",
  );

  const completions = check(marked);

  expect(completions.items).toEqual([
    value("raw"),
    value("content"),
    value("response"),
  ]);
});

test("the word after a surrogate pair is placed in UTF-16 units", () => {
  const marked = guardedFlow.replace(
    "  - greet:\n      set:\n        message: hello\n",
    "  - greet: { set: { message: '𐐀' }, th‸ }\n",
  );

  const completions = check(marked);

  expect(completions.range).toEqual({
    start: { line: 7, column: 38 },
    end: { line: 7, column: 40 },
  });
});

test("a text that does not read offers nothing", () => {
  const completions = check("do: [‸\n");

  expect(completions.items).toEqual([]);
});

test("a new task's first member offers the members of every kind", () => {
  const marked = `${inlineHeader}do:\n  - a:\n      se‸\n`;

  const completions = check(marked);

  const labels = completions.items.map((item) => item.label);
  expect(labels).toEqual([
    "if",
    "input",
    "output",
    "export",
    "timeout",
    "then",
    "metadata",
    "call",
    "with",
    "do",
    "fork",
    "emit",
    "for",
    "while",
    "listen",
    "foreach",
    "raise",
    "run",
    "set",
    "switch",
    "try",
    "catch",
    "wait",
  ]);
});

test("an object's first member offers its members", () => {
  const marked = `${inlineHeader}do:\n  - fetch:\n      call: http\n      with:\n        ‸\n`;

  const completions = check(marked);

  const labels = completions.items.map((item) => item.label);
  expect(labels).toEqual([
    "method",
    "endpoint",
    "headers",
    "body",
    "query",
    "output",
    "redirect",
  ]);
});

test("a text the grammar rejects still offers members", () => {
  const marked = guardedFlow.replace(
    "message: hello\n",
    "message: hello\n      nope: 1\n      ti‸\n",
  );

  const completions = check(marked);

  const labels = completions.items.map((item) => item.label);
  expect(labels).toEqual([
    "if",
    "input",
    "output",
    "export",
    "timeout",
    "then",
    "metadata",
  ]);
});

test("inside an expression the names in scope are offered", () => {
  const marked = orderFlow.replace("sum: ${ $order.price }", "sum: ${ $or‸ }");

  const completions = check(marked);

  expect(completions).toEqual({
    range: { start: { line: 10, column: 23 }, end: { line: 10, column: 26 } },
    items: [
      {
        label: "$context",
        insert: "$context",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$input",
        insert: "$input",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$secrets",
        insert: "$secrets",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$task",
        insert: "$task",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$workflow",
        insert: "$workflow",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$runtime",
        insert: "$runtime",
        kind: "variable",
        description: "runtime argument",
      },
      {
        label: "$order",
        insert: "$order",
        kind: "variable",
        description: "loop item",
      },
      {
        label: "$index",
        insert: "$index",
        kind: "variable",
        description: "loop index",
      },
    ],
  });
});

test("inside a quoted expression the names in scope are offered", () => {
  const marked = orderFlow.replace('"${ $order.name }"', '"${ $‸ }"');

  const completions = check(marked);

  const labels = completions.items.map((item) => item.label);
  expect(labels).toEqual([
    "$context",
    "$input",
    "$secrets",
    "$task",
    "$workflow",
    "$runtime",
    "$order",
    "$index",
  ]);
});

test("an expression whose scalar has an escape offers no names", () => {
  const marked = orderFlow.replace('"${ $order.name }"', '"${ $‸ }\\t"');

  const completions = check(marked);

  expect(completions.items).toEqual([]);
});
