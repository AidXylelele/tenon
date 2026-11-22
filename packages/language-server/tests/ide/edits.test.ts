import { expect, test } from "vitest";
import { appliedOf } from "../../src/ide/text/index.js";
import { editsOf } from "../../src/ide/edits/index.js";
import type { EditAction } from "../../src/protocol/index.js";
import { guardedFlow, inlineHeader } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

const commented = guardedFlow
  .replace("  - guard:", "  # the fetch, guarded\n  - guard:")
  .replace("then: guard", "then: guard  # keep me");

const fetchLines = `        - fetch:
            call: http
            with:
              method: get
              endpoint: https://example.com
`;

function check(text: string, action: EditAction) {
  const snapshot = snapshotOf(text);

  return editsOf(snapshot, action);
}

function outcomeOf(text: string, action: EditAction) {
  const editing = check(text, action);

  if (editing.kind === "refused") {
    return editing;
  }

  const edited = appliedOf(text, editing.changes);
  const diagnostics = snapshotOf(edited).analysis.diagnostics;
  return { text: edited, ids: editing.ids, diagnostics };
}

test("a new step goes between two, before the comment of the second", () => {
  const action: EditAction = {
    kind: "insertStep",
    list: "/do",
    index: 1,
    step: "wait",
    name: null,
  };

  const outcome = outcomeOf(commented, action);

  const expected = commented.replace(
    "  # the fetch, guarded\n",
    "  - wait:\n      wait: PT1S\n  # the fetch, guarded\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a new step in a flow list is written inline", () => {
  const text = `${inlineHeader}do: [ { a: { set: { x: 1 } } } ]\n`;
  const action: EditAction = {
    kind: "insertStep",
    list: "/do",
    index: 1,
    step: "wait",
    name: null,
  };

  const outcome = outcomeOf(text, action);

  const expected = `${inlineHeader}do: [ { a: { set: { x: 1 } } }, { wait: { wait: PT1S } } ]\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a step inserted into a new try is written as block text", () => {
  const text = `${inlineHeader}do:\n  - guard:\n      try: []\n      catch: {}\n`;
  const action: EditAction = {
    kind: "insertStep",
    list: "/do/guard/try",
    index: 0,
    step: "wait",
    name: null,
  };

  const outcome = outcomeOf(text, action);

  const expected = `${inlineHeader}do:\n  - guard:\n      try:\n        - wait:\n            wait: PT1S\n      catch: {}\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a second wait takes the next free name", () => {
  const text = `${inlineHeader}do: [ { wait: { wait: PT1S } } ]\n`;
  const action: EditAction = {
    kind: "insertStep",
    list: "/do",
    index: 1,
    step: "wait",
    name: null,
  };

  const outcome = outcomeOf(text, action);

  const expected = `${inlineHeader}do: [ { wait: { wait: PT1S } }, { wait-2: { wait: PT1S } } ]\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a move within its list keeps its text, its comments and every id", () => {
  const action: EditAction = {
    kind: "moveStep",
    step: "/do/route",
    list: "/do",
    index: 0,
  };

  const outcome = outcomeOf(commented, action);

  const routeStart = commented.indexOf("  - route:");
  const greetStart = commented.indexOf("  - greet:");
  const route = commented.slice(routeStart);
  const before = commented.slice(greetStart, routeStart);
  const expected = commented.replace(before + route, route + before);
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("the index of a move is the one the step has after it", () => {
  const action: EditAction = {
    kind: "moveStep",
    step: "/do/greet",
    list: "/do",
    index: 2,
  };

  const outcome = outcomeOf(guardedFlow, action);

  const greet = "  - greet:\n      set:\n        message: hello\n";
  const expected = guardedFlow.replace(greet, "") + greet;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a move into another list re-indents the step and maps its id", () => {
  const action: EditAction = {
    kind: "moveStep",
    step: "/do/guard/try/fetch",
    list: "/do",
    index: 0,
  };

  const outcome = outcomeOf(guardedFlow, action);

  const moved = `  - fetch:
      call: http
      with:
        method: get
        endpoint: https://example.com
`;
  const expected = guardedFlow
    .replace(fetchLines, "")
    .replace("      try:\n", "      try: []\n")
    .replace("do:\n  - greet", `do:\n${moved}  - greet`);
  expect(outcome).toEqual({
    text: expected,
    ids: [{ from: "/do/guard/try/fetch", to: "/do/fetch" }],
    diagnostics: [],
  });
});

test("a removed step leaves the rest byte for byte", () => {
  const action: EditAction = { kind: "removeStep", step: "/do/greet" };

  const outcome = outcomeOf(commented, action);

  const expected = commented.replace(
    "  - greet:\n      set:\n        message: hello\n",
    "",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a duplicate follows its step under the next free name", () => {
  const action: EditAction = { kind: "duplicateStep", step: "/do/greet" };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = guardedFlow.replace(
    "        message: hello\n",
    "        message: hello\n  - greet-2:\n      set:\n        message: hello\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a renamed step maps its id and every id below it", () => {
  const action: EditAction = {
    kind: "renameStep",
    step: "/do/guard",
    name: "shield",
  };

  const outcome = outcomeOf(commented, action);

  const expected = commented
    .replace("- guard:", "- shield:")
    .replace("then: guard", "then: shield");
  expect(outcome).toEqual({
    text: expected,
    ids: [
      { from: "/do/guard", to: "/do/shield" },
      { from: "/do/guard/try", to: "/do/shield/try" },
      { from: "/do/guard/try/fetch", to: "/do/shield/try/fetch" },
      { from: "/do/guard/catch/do", to: "/do/shield/catch/do" },
      { from: "/do/guard/catch/do/notify", to: "/do/shield/catch/do/notify" },
    ],
    diagnostics: [],
  });
});

test("a written field is set in place", () => {
  const action: EditAction = {
    kind: "setField",
    pointer: "/do/0/greet/set/message",
    value: "bye",
  };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = guardedFlow.replace("message: hello", "message: bye");
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("an unwritten field is set on a line after the last member", () => {
  const action: EditAction = {
    kind: "setField",
    pointer: "/do/0/greet/then",
    value: "end",
  };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = guardedFlow.replace(
    "        message: hello\n",
    "        message: hello\n      then: end\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("the trigger is set as a field of the document", () => {
  const action: EditAction = {
    kind: "setField",
    pointer: "/schedule",
    value: { every: { minutes: 5 } },
  };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = `${guardedFlow}schedule:\n  every:\n    minutes: 5\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a cleared field loses its line", () => {
  const ending = guardedFlow.replace(
    "        message: hello\n",
    "        message: hello\n      then: end\n",
  );
  const action: EditAction = {
    kind: "clearField",
    pointer: "/do/0/greet/then",
  };

  const outcome = outcomeOf(ending, action);

  expect(outcome).toEqual({ text: guardedFlow, ids: [], diagnostics: [] });
});

test("a field after a surrogate pair is placed in UTF-16 units", () => {
  const text = `${inlineHeader}do:\n  - a: { set: { x: '𐐀' }, then: end }\n`;
  const action: EditAction = {
    kind: "setField",
    pointer: "/do/0/a/then",
    value: "exit",
  };

  const outcome = outcomeOf(text, action);

  const expected = text.replace("then: end", "then: exit");
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a document that does not analyse is not edited", () => {
  const action: EditAction = { kind: "removeStep", step: "/do/greet" };

  const outcome = outcomeOf("do: [\n", action);

  expect(outcome).toEqual({
    kind: "refused",
    reason: "The document does not analyse; edit it in the text.",
  });
});

test("a field is set in a text the grammar refuses, so the form can mend it", () => {
  const broken = `${guardedFlow}schedule:\n  every: 1 minute\n`;
  const action: EditAction = {
    kind: "setField",
    pointer: "/schedule/every",
    value: { minutes: 1 },
  };

  const outcome = outcomeOf(broken, action);

  const expected = `${guardedFlow}schedule:\n  every: { minutes: 1 }\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

const flowSteps = `${inlineHeader}do: [ { a: { set: { x: 1 } } }, { b: { set: { y: 2 } } } ]\n`;

test("a removed step leaves its flow list with a comma less", () => {
  const action: EditAction = { kind: "removeStep", step: "/do/a" };

  const outcome = outcomeOf(flowSteps, action);

  const expected = `${inlineHeader}do: [ { b: { set: { y: 2 } } } ]\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a duplicate in a flow list follows its step inline", () => {
  const action: EditAction = { kind: "duplicateStep", step: "/do/a" };

  const outcome = outcomeOf(flowSteps, action);

  const expected = `${inlineHeader}do: [ { a: { set: { x: 1 } } }, { a-2: { set: { x: 1 } } }, { b: { set: { y: 2 } } } ]\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

const twoGreets = guardedFlow.replace("- notify:", "- greet:");

test.each<readonly [string, string, EditAction, string]>([
  [
    "an unknown step",
    guardedFlow,
    { kind: "removeStep", step: "/do/nowhere" },
    "No step with the id /do/nowhere stands in the text.",
  ],
  [
    "an unknown list",
    guardedFlow,
    {
      kind: "insertStep",
      list: "/do/nowhere",
      index: 0,
      step: "wait",
      name: null,
    },
    "No list with the id /do/nowhere stands in the text.",
  ],
  [
    "an index outside the list",
    guardedFlow,
    { kind: "insertStep", list: "/do", index: 9, step: "wait", name: null },
    "The list has no place 9.",
  ],
  [
    "an insert under a sibling's name",
    guardedFlow,
    { kind: "insertStep", list: "/do", index: 0, step: "wait", name: "greet" },
    "A step named 'greet' already stands in this list.",
  ],
  [
    "an insert under a flow directive",
    guardedFlow,
    { kind: "insertStep", list: "/do", index: 0, step: "wait", name: "end" },
    "'end' is a flow directive, not a name.",
  ],
  [
    "a move into the step's own lists",
    guardedFlow,
    { kind: "moveStep", step: "/do/guard", list: "/do/guard/try", index: 0 },
    "A step cannot move into its own lists.",
  ],
  [
    "a move into a list that holds the name",
    twoGreets,
    {
      kind: "moveStep",
      step: "/do/guard/catch/do/greet",
      list: "/do",
      index: 0,
    },
    "A step named 'greet' already stands in this list.",
  ],
  [
    "a field below a value that holds none",
    guardedFlow,
    { kind: "setField", pointer: "/do/0/greet/set/message/deep", value: 1 },
    "/do/0/greet/set/message/deep has no object in the text to hold it.",
  ],
  [
    "clearing a field that is not written",
    guardedFlow,
    { kind: "clearField", pointer: "/do/0/greet/then" },
    "No written field stands at '/do/0/greet/then'.",
  ],
])("%s is refused", (_, text, action, reason) => {
  const editing = check(text, action);

  expect(editing).toEqual({ kind: "refused", reason });
});

const retried = guardedFlow.replace(
  "  - greet:\n      set:\n        message: hello\n",
  `  - greet:
      try:
        - greet:
            set:
              message: hello
      catch:
        retry:
          delay:
            seconds: 5
          backoff:
            constant: {}
          limit:
            attempt:
              count: 3
`,
);

const retry = {
  kind: "retry",
  attempts: 3,
  seconds: 5,
  growing: false,
} as const;

test("a retry wraps the step in a try and maps its ids", () => {
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/greet",
    failure: retry,
  };

  const outcome = outcomeOf(guardedFlow, action);

  expect(outcome).toEqual({
    text: retried,
    ids: [{ from: "/do/greet", to: "/do/greet/try/greet" }],
    diagnostics: [],
  });
});

test("a step's then moves to the try that protects it", () => {
  const text = `${inlineHeader}do:\n  - pause:\n      wait: PT1S\n      then: end\n`;
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/pause",
    failure: { kind: "continue" },
  };

  const outcome = outcomeOf(text, action);

  const expected = `${inlineHeader}do:\n  - pause:\n      try:\n        - pause:\n            wait: PT1S\n      catch: {}\n      then: end\n`;
  expect(outcome).toEqual({
    text: expected,
    ids: [{ from: "/do/pause", to: "/do/pause/try/pause" }],
    diagnostics: [],
  });
});

test("stop gives a protected step its own text back", () => {
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/greet",
    failure: { kind: "stop" },
  };

  const outcome = outcomeOf(retried, action);

  expect(outcome).toEqual({
    text: guardedFlow,
    ids: [{ from: "/do/greet/try/greet", to: "/do/greet" }],
    diagnostics: [],
  });
});

test("handling a protected step's failure writes an empty list of steps", () => {
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/greet",
    failure: { kind: "handle" },
  };

  const outcome = outcomeOf(retried, action);

  const expected = retried.replace(
    "      catch:\n        retry:\n          delay:\n            seconds: 5\n          backoff:\n            constant: {}\n          limit:\n            attempt:\n              count: 3\n",
    "      catch:\n        do: []\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("stop on a step with no protection changes nothing", () => {
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/greet",
    failure: { kind: "stop" },
  };

  const editing = check(guardedFlow, action);

  expect(editing).toEqual({ kind: "edited", changes: [], ids: [] });
});

test("a step of a flow list is protected inline", () => {
  const text = `${inlineHeader}do: [ { a: { set: { x: 1 } } } ]\n`;
  const action: EditAction = {
    kind: "setFailure",
    step: "/do/a",
    failure: { kind: "continue" },
  };

  const outcome = outcomeOf(text, action);

  const expected = `${inlineHeader}do: [ { a: { try: [ { a: { set: { x: 1 } } } ], catch: {} } } ]\n`;
  expect(outcome).toEqual({
    text: expected,
    ids: [{ from: "/do/a", to: "/do/a/try/a" }],
    diagnostics: [],
  });
});

test("the workflow's title is set as a field of its header", () => {
  const action: EditAction = {
    kind: "setField",
    pointer: "/document/title",
    value: "Orders",
  };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = guardedFlow.replace(
    "  version: '0.1.0'\n",
    "  version: '0.1.0'\n  title: Orders\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a field set where the text has no holder writes the holders as an author would", () => {
  const action: EditAction = {
    kind: "setField",
    pointer: "/input/schema",
    value: { document: { type: "object" } },
  };

  const outcome = outcomeOf(guardedFlow, action);

  const expected = `${guardedFlow}input:\n  schema:\n    document:\n      type: object\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("another trigger is chosen by writing the schedule whole", () => {
  const every = `${guardedFlow}schedule:\n  every: { minutes: 15 }\n`;
  const action: EditAction = {
    kind: "setField",
    pointer: "/schedule",
    value: { cron: "0 9 * * *" },
  };

  const outcome = outcomeOf(every, action);

  const expected = `${guardedFlow}schedule: { cron: 0 9 * * * }\n`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});
