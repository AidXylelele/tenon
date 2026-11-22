import type { JsonObject } from "interpreter/front-end";
import { expect, test } from "vitest";
import { editsOf } from "../../src/ide/edits/index.js";
import { valueAt } from "../../src/ide/pointers/index.js";
import { sourceOf } from "../../src/ide/snapshot/index.js";
import {
  type Step,
  type StepList,
  structureReadingOf,
  type Transition,
} from "../../src/ide/structure/index.js";
import { appliedOf } from "../../src/ide/text/index.js";
import type {
  ChosenResult,
  EditAction,
  StepVariant,
} from "../../src/protocol/index.js";
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

const routeFlow = `${inlineHeader}do:
  - route:
      switch:
        - big:
            when: \${ .big }
            then: continue
        - small:
            when: \${ .small }
            then: report
        - stop:
            when: \${ .stop }
            then: end
        - default:
            then: continue
  # the total of the big ones
  - total:
      set:
        total: 1
  - report:
      set:
        reported: true
`;

const lastRouteFlow = `${inlineHeader}do:
  - fetch:
      set:
        items: []
  - route:
      switch:
        - some:
            when: \${ .items != [] }
            then: continue
        - none:
            when: \${ .items == [] }
            then: end
`;

const nestedRouteFlow = `${inlineHeader}do:
  - each:
      for:
        in: \${ .orders }
        each: order
      do:
        - route:
            switch:
              - skip:
                  when: \${ $order.skip }
                  then: exit
              - default:
                  then: continue
`;

const undefaultedRouteFlow = `${inlineHeader}do:
  - route:
      switch:
        - big:
            when: \${ .big }
            then: end
  - total:
      set:
        total: 1
`;

const inlineRouteFlow = `${inlineHeader}do: [ { route: { switch: [ { big: { when: '\${ .big }', then: continue } }, { other: { then: continue } } ] } }, { total: { set: { total: 1 } } } ]
`;

const forkedRouteFlow = `${inlineHeader}do:
  - alarm:
      fork:
        branches:
          - route:
              switch:
                - severe:
                    when: \${ .severe }
                    then: continue
          - nurse:
              set:
                called: nurse
`;

function branchActionOf(
  routeId: string,
  branch: string,
  name: string | null,
): EditAction {
  return {
    kind: "insertStepOnBranch",
    switch: routeId,
    case: branch,
    step: "wait",
    name,
  };
}

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
    "  - wait:\n      wait: PT30M\n  # the fetch, guarded\n",
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

  const expected = `${inlineHeader}do: [ { a: { set: { x: 1 } } }, { wait: { wait: PT30M } } ]\n`;
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

  const expected = `${inlineHeader}do:\n  - guard:\n      try:\n        - wait:\n            wait: PT30M\n      catch: {}\n`;
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

  const expected = `${inlineHeader}do: [ { wait: { wait: PT1S } }, { wait-2: { wait: PT30M } } ]\n`;
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
  [
    "a step on a branch of a step that is not a switch",
    routeFlow,
    branchActionOf("/do/total", "big", null),
    "The step /do/total is not a switch.",
  ],
  [
    "a step on a branch the switch does not have",
    routeFlow,
    branchActionOf("/do/route", "nowhere", null),
    "The switch /do/route has no branch named 'nowhere'.",
  ],
  [
    "a step on a branch of a switch that is a fork's branch",
    forkedRouteFlow,
    branchActionOf("/do/alarm/fork/branches/route", "severe", null),
    "A switch that is a branch of a fork has no list to add a step to.",
  ],
  [
    "a step on a branch under a sibling's name",
    routeFlow,
    branchActionOf("/do/route", "big", "total"),
    "A step named 'total' already stands in this list.",
  ],
  [
    "a step on a branch of an unknown step",
    routeFlow,
    branchActionOf("/do/nowhere", "big", null),
    "No step with the id /do/nowhere stands in the text.",
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

const scriptFlow = `${inlineHeader}do:
  - compute:
      run:
        script:
          language: js
          code: "return 1;"
`;

const codePointer = "/do/0/compute/run/script/code";

const quotedCode = '          code: "return 1;"\n';

function settingOf(value: string): EditAction {
  return { kind: "setField", pointer: codePointer, value };
}

function readBackOf(text: string, action: EditAction) {
  const editing = check(text, action);

  if (editing.kind === "refused") {
    return editing;
  }

  const edited = appliedOf(text, editing.changes);
  const snapshot = snapshotOf(edited);
  const source = sourceOf(snapshot.analysis);

  if (source === null) {
    return source;
  }

  return valueAt(source.document, codePointer);
}

test.each([
  [
    "three lines that end in a line break are written with clip chomping",
    "const a = 1;\nconst b = 2;\nreturn a + b;\n",
    "          code: |\n            const a = 1;\n            const b = 2;\n            return a + b;\n",
  ],
  [
    "three lines with no final line break are written with strip chomping",
    "const a = 1;\nconst b = 2;\nreturn a + b;",
    "          code: |-\n            const a = 1;\n            const b = 2;\n            return a + b;\n",
  ],
])("%s, as a literal block under the key", (_, code, lines) => {
  const action = settingOf(code);

  const outcome = outcomeOf(scriptFlow, action);

  const expected = scriptFlow.replace(quotedCode, lines);
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test.each([
  ["a final line break", "one\ntwo\n"],
  ["no final line break", "one\ntwo"],
  ["an indented first line", "  one\ntwo"],
  ["trailing empty lines", "one\ntwo\n\n"],
])("a literal block with %s reads back as the value set", (_, code) => {
  const action = settingOf(code);

  const read = readBackOf(scriptFlow, action);

  expect(read).toBe(code);
});

test("a one-line edit of a quoted value stays quoted", () => {
  const action = settingOf("return 2;");

  const outcome = outcomeOf(scriptFlow, action);

  const expected = scriptFlow.replace('"return 1;"', '"return 2;"');
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a one-line edit of a literal block keeps it a block", () => {
  const block = scriptFlow.replace(
    quotedCode,
    "          code: |\n            return 1;\n",
  );
  const action = settingOf("return 2;");

  const outcome = outcomeOf(block, action);

  const expected = scriptFlow.replace(
    quotedCode,
    "          code: |-\n            return 2;\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a comment after the value moves to the block's header", () => {
  const commentedCode = scriptFlow.replace(
    quotedCode,
    '          code: "return 1;"  # the result\n    # the next step\n',
  );
  const action = settingOf("a;\nreturn 2;");

  const outcome = outcomeOf(commentedCode, action);

  const expected = scriptFlow.replace(
    quotedCode,
    "          code: |-  # the result\n            a;\n            return 2;\n    # the next step\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a multi-line value in a flow mapping stays on its line, double-quoted", () => {
  const inline = scriptFlow.replace(
    '        script:\n          language: js\n          code: "return 1;"\n',
    "        script: { language: js, code: 'return 1;' }\n",
  );
  const action = settingOf("a;\nreturn 2;");

  const outcome = outcomeOf(inline, action);

  const expected = inline.replace("'return 1;'", '"a;\\nreturn 2;"');
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("an unwritten multi-line field is added as a literal block", () => {
  const uncoded = scriptFlow.replace(quotedCode, "");
  const action = settingOf("a;\nreturn 2;");

  const outcome = outcomeOf(uncoded, action);

  const expected = scriptFlow.replace(
    quotedCode,
    "          code: |-\n            a;\n            return 2;\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a multi-line item of a block sequence is a literal block under its dash", () => {
  const noted = scriptFlow.replace(
    "      run:\n",
    "      metadata:\n        lines:\n          - first\n      run:\n",
  );
  const action: EditAction = {
    kind: "setField",
    pointer: "/do/0/compute/metadata/lines/0",
    value: "first\nsecond",
  };

  const outcome = outcomeOf(noted, action);

  const expected = noted.replace(
    "          - first\n",
    "          - |-\n            first\n            second\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a comment on a block's header stays on it", () => {
  const block = scriptFlow.replace(
    quotedCode,
    "          code: |  # the result\n            return 1;\n",
  );
  const action = settingOf("a;\nreturn 2;");

  const outcome = outcomeOf(block, action);

  const expected = scriptFlow.replace(
    quotedCode,
    "          code: |-  # the result\n            a;\n            return 2;\n",
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

const pause = "  - pause:\n      wait: PT30M\n";

const branchSteps: readonly (readonly [
  string,
  string,
  string,
  string,
  string,
])[] = [
  [
    "a branch that continues still continues, into the new step, and another branch that continued names the step after the switch",
    routeFlow,
    "/do/route",
    "big",
    routeFlow
      .replace(
        "        - default:\n            then: continue\n",
        "        - default:\n            then: total\n",
      )
      .replace("  # the total", `${pause}  # the total`),
  ],
  [
    "a branch that names a step names the new step, which names that step, and the branches that continued name the step after the switch",
    routeFlow,
    "/do/route",
    "small",
    routeFlow
      .replace("            then: continue\n", "            then: total\n")
      .replace("then: report", "then: pause")
      .replace(
        "        - default:\n            then: continue\n",
        "        - default:\n            then: total\n",
      )
      .replace("  # the total", `${pause}      then: report\n  # the total`),
  ],
  [
    "a branch that ends the run leads to the new step, which ends the run, and the branches that continued name the step after the switch",
    routeFlow,
    "/do/route",
    "stop",
    routeFlow
      .replace("            then: continue\n", "            then: total\n")
      .replace("            then: end\n", "            then: pause\n")
      .replace(
        "        - default:\n            then: continue\n",
        "        - default:\n            then: total\n",
      )
      .replace("  # the total", `${pause}      then: end\n  # the total`),
  ],
  [
    "a branch that leaves its block leads to the new step, which leaves it, and another branch that continued leaves it too",
    nestedRouteFlow,
    "/do/each/do/route",
    "skip",
    nestedRouteFlow
      .replace("then: exit", "then: pause")
      .replace("then: continue", "then: exit")
      .concat(
        "        - pause:\n            wait: PT30M\n            then: exit\n",
      ),
  ],
  [
    "a switch that was the workflow's last step ends the run where it fell off the end, its own then included",
    lastRouteFlow,
    "/do/route",
    "some",
    lastRouteFlow.concat(`      then: end\n${pause}`),
  ],
  [
    "a switch with no default case names the step after it in its own then",
    undefaultedRouteFlow,
    "/do/route",
    "big",
    undefaultedRouteFlow
      .replace(
        "            then: end\n",
        "            then: pause\n      then: total\n",
      )
      .replace("  - total:", `${pause}      then: end\n  - total:`),
  ],
  [
    "a switch written inline gets its step inline",
    inlineRouteFlow,
    "/do/route",
    "big",
    inlineRouteFlow
      .replace("{ other: { then: continue } }", "{ other: { then: total } }")
      .replace(" { total:", " { pause: { wait: PT30M } }, { total:"),
  ],
];

type Route = readonly string[];

function editedOf(text: string, action: EditAction): string {
  const editing = check(text, action);

  if (editing.kind === "refused") {
    throw new Error(editing.reason);
  }

  return appliedOf(text, editing.changes);
}

function routesOf(
  text: string,
  switchId: string,
): Readonly<Record<string, Route>> {
  const snapshot = snapshotOf(text);
  const { workflow } = structureReadingOf(snapshot);
  const list = listHoldingOf(workflow.steps, switchId);
  const steps = list?.steps ?? [];
  const isRoot = list === workflow.steps;
  const route = steps.find((step) => step.id === switchId);
  const ways = route?.flow ?? [];
  const cases = ways.filter((way) => way.on === "case");
  const hasDefault = cases.some((way) => way.when === null);
  const reachable = hasDefault ? cases : ways;
  const routes = reachable.map((way) => {
    const name = way.case ?? "no case matches";
    return [name, pathOf(steps, way, isRoot)] as const;
  });

  return Object.fromEntries(routes);
}

function listHoldingOf(list: StepList, id: string): StepList | null {
  const holds = list.steps.some((step) => step.id === id);

  if (holds) {
    return list;
  }

  const nested = list.steps.flatMap((step) => step.lists);
  const holders = nested.map((inner) => listHoldingOf(inner, id));
  return holders.find((holder) => holder !== null) ?? null;
}

function pathOf(
  steps: readonly Step[],
  way: Transition,
  isRoot: boolean,
): Route {
  const leaving = isRoot ? "the run ends" : "the block completes";

  switch (way.kind) {
    case "end":
      return ["the run ends"];
    case "exit":
      return [leaving];
    case "next":
    case "jump":
      return pathFromOf(steps, way.to, isRoot);
  }
}

function pathFromOf(
  steps: readonly Step[],
  id: string | null,
  isRoot: boolean,
): Route {
  const leaving = isRoot ? "the run ends" : "the block completes";
  const step = steps.find((candidate) => candidate.id === id);
  const done = step?.flow.find((each) => each.on === "done");

  if (step === undefined || done === undefined) {
    return [leaving];
  }

  const rest = pathOf(steps, done, isRoot);
  return [step.name, ...rest];
}

test.each(branchSteps)("%s", (_, text, switchId, branch, expected) => {
  const action = branchActionOf(switchId, branch, "pause");

  const outcome = outcomeOf(text, action);

  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test.each(branchSteps)(
  "%s: the branch passes the new step and every other way out of the switch keeps its route",
  (_, text, switchId, branch) => {
    const action = branchActionOf(switchId, branch, "pause");
    const before = routesOf(text, switchId);

    const edited = editedOf(text, action);

    const after = routesOf(edited, switchId);
    const chosen = before[branch] ?? [];
    const expected = { ...before, [branch]: ["pause", ...chosen] };
    expect(after).toEqual(expected);
  },
);

const emptyFlow = `${inlineHeader}do: []\n`;

const validationError =
  "https://open-workflow-specification.org/spec/1.0.0/errors/validation";

function startOf(variant: StepVariant) {
  const action: EditAction = {
    kind: "insertStep",
    list: "/do",
    index: 0,
    step: variant,
    name: null,
  };
  const edited = editedOf(emptyFlow, action);
  const snapshot = snapshotOf(edited);
  const source = sourceOf(snapshot.analysis);
  const pointer = `/do/0/${variant}`;
  const document = source?.document ?? null;
  const content = valueAt(document, pointer);
  const problems = snapshot.analysis.diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.pointer,
  ]);

  return { content, problems };
}

test.each<readonly [StepVariant, JsonObject, readonly (readonly string[])[]]>([
  [
    "http",
    { call: "http", with: { method: "get", endpoint: "" } },
    [["schema", "/do/0/http/with/endpoint"]],
  ],
  [
    "openapi",
    { call: "openapi", with: { document: { endpoint: "" }, operationId: "" } },
    [["schema", "/do/0/openapi/with/document/endpoint"]],
  ],
  [
    "grpc",
    {
      call: "grpc",
      with: {
        proto: { endpoint: "" },
        service: { name: "", host: "" },
        method: "",
      },
    },
    [
      ["schema", "/do/0/grpc/with/proto/endpoint"],
      ["schema", "/do/0/grpc/with/service/host"],
    ],
  ],
  [
    "asyncapi",
    {
      call: "asyncapi",
      with: { document: { endpoint: "" }, operation: "", message: {} },
    },
    [["schema", "/do/0/asyncapi/with/document/endpoint"]],
  ],
  [
    "mcp",
    {
      call: "mcp",
      with: {
        method: "tools/call",
        parameters: { name: "" },
        transport: { http: { endpoint: "" } },
      },
    },
    [["schema", "/do/0/mcp/with/transport/http/endpoint"]],
  ],
  [
    "a2a",
    { call: "a2a", with: { method: "message/send", server: "" } },
    [["schema", "/do/0/a2a/with/server"]],
  ],
  [
    "script-js",
    {
      run: {
        script: {
          language: "js",
          code: "const result = {};\nconsole.log(JSON.stringify(result));\n",
        },
      },
      output: { as: "${ fromjson }" },
    },
    [],
  ],
  [
    "script-python",
    {
      run: {
        script: {
          language: "python",
          code: "import json\n\nresult = {}\nprint(json.dumps(result))\n",
        },
      },
      output: { as: "${ fromjson }" },
    },
    [],
  ],
  ["shell", { run: { shell: { command: "" } } }, []],
  ["container", { run: { container: { image: "" } } }, []],
  [
    "workflow",
    { run: { workflow: { namespace: "", name: "", version: "" } } },
    [],
  ],
  ["do", { do: [] }, []],
  ["emit", { emit: { event: { with: { type: "" } } } }, []],
  [
    "for",
    { for: { each: "item", in: "" }, do: [] },
    [["expression", "/do/0/for/for/in"]],
  ],
  ["fork", { fork: { branches: [] } }, []],
  ["listen", { listen: { to: { one: { with: { type: "" } } } } }, []],
  [
    "raise",
    { raise: { error: { type: validationError, status: 400, title: "" } } },
    [],
  ],
  ["set", { set: { value: "" }, output: { as: "${ $input + . }" } }, []],
  ["switch", { switch: [{ default: { then: "continue" } }] }, []],
  [
    "try",
    {
      try: [],
      catch: {
        retry: {
          delay: { seconds: 2 },
          backoff: { exponential: {} },
          limit: { attempt: { count: 3 } },
        },
      },
    },
    [],
  ],
  ["wait", { wait: "PT30M" }, []],
])(
  "a %s step starts with its smallest content, the blanks a person fills named by problems",
  (variant, content, problems) => {
    const started = startOf(variant);

    expect(started).toEqual({ content, problems });
  },
);

test("a JavaScript step starts with code that prints its result as JSON and an output that parses it", () => {
  const action: EditAction = {
    kind: "insertStep",
    list: "/do",
    index: 0,
    step: "script-js",
    name: null,
  };

  const outcome = outcomeOf(emptyFlow, action);

  const expected = `${inlineHeader}do:
  - script-js:
      run:
        script:
          language: js
          code: |
            const result = {};
            console.log(JSON.stringify(result));
      output:
        as: \${ fromjson }
`;
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

const resultHeader = `${inlineHeader}do:\n  - step:\n`;

const jsonScript = `${resultHeader}      run:
        script:
          language: js
          code: ""
      output:
        as: \${ fromjson }
`;

const textScript = `${resultHeader}      run:
        script:
          language: js
          code: ""
`;

const codeScript = `${textScript}        return: code
`;

const mergingSet = `${resultHeader}      set:
        total: 1
      output:
        as: \${ $input + . }
`;

const plainSet = `${resultHeader}      set:
        total: 1
`;

const schemedScript = jsonScript.replace(
  "      output:\n",
  "      output:\n        schema:\n          document:\n            type: object\n",
);

test.each<readonly [string, string, ChosenResult, string]>([
  [
    "a script's printed text drops the output that parsed it",
    jsonScript,
    "printedText",
    textScript,
  ],
  ["a script's exit code returns its code", textScript, "exitCode", codeScript],
  [
    "a script's printed JSON parses what it prints and returns what it prints",
    codeScript,
    "printedJson",
    jsonScript,
  ],
  [
    "a set's values alone drop the output that added its input",
    mergingSet,
    "valuesOnly",
    plainSet,
  ],
  [
    "a set's values beside its input add the input in its output",
    plainSet,
    "inputAndValues",
    mergingSet,
  ],
  [
    "an output that holds more than the parse keeps the rest",
    schemedScript,
    "printedText",
    schemedScript.replace("        as: ${ fromjson }\n", ""),
  ],
])("%s", (_, text, result, expected) => {
  const action: EditAction = { kind: "setResult", step: "/do/step", result };

  const outcome = outcomeOf(text, action);

  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a result the step does not offer is refused", () => {
  const action: EditAction = {
    kind: "setResult",
    step: "/do/step",
    result: "printedJson",
  };

  const editing = check(plainSet, action);

  expect(editing).toEqual({
    kind: "refused",
    reason: "The step /do/step offers no result 'printedJson'.",
  });
});

const pickFlow = `${inlineHeader}do:
  - fetch:
      call: http
      with: { method: get, endpoint: https://api.test/orders }
  - total:
      set:
        count: 2
  - report:
      call: http
      with:
        method: post
        endpoint: https://api.test/report
        body: {}
`;

const fetchExport = `      export:\n        as: '\${ $context + { "fetch": . } }'\n`;

function useOf(value: string, exported: string | null): EditAction {
  return {
    kind: "useData",
    pointer: "/do/2/report/with/body",
    value,
    export: exported,
  };
}

test("data used where it flows in is written into the field alone", () => {
  const action = useOf("${ .count }", null);

  const outcome = outcomeOf(pickFlow, action);

  const expected = pickFlow.replace("body: {}", "body: ${ .count }");
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("an earlier step's output used through the context exports it under its name (dsl.md, Data Flow, step 7)", () => {
  const action = useOf("${ $context.fetch }", "/do/fetch");

  const outcome = outcomeOf(pickFlow, action);

  const expected = pickFlow
    .replace(
      "      with: { method: get, endpoint: https://api.test/orders }\n",
      `      with: { method: get, endpoint: https://api.test/orders }\n${fetchExport}`,
    )
    .replace("body: {}", "body: ${ $context.fetch }");
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a step already exported under its name is not exported again", () => {
  const exported = pickFlow.replace(
    "      with: { method: get, endpoint: https://api.test/orders }\n",
    `      with: { method: get, endpoint: https://api.test/orders }\n${fetchExport}`,
  );
  const action = useOf("${ $context.fetch }", "/do/fetch");

  const outcome = outcomeOf(exported, action);

  const expected = exported.replace("body: {}", "body: ${ $context.fetch }");
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a step that writes its own export is not exported over it", () => {
  const ownExport = pickFlow.replace(
    "      with: { method: get, endpoint: https://api.test/orders }\n",
    "      with: { method: get, endpoint: https://api.test/orders }\n      export:\n        as: '${ { kept: true } }'\n",
  );
  const action = useOf("${ $context.fetch }", "/do/fetch");

  const editing = check(ownExport, action);

  expect(editing).toEqual({
    kind: "refused",
    reason: "The step /do/fetch writes its own export; edit it in the text.",
  });
});

const conditionFlow = `${inlineHeader}do:
  - route:
      switch:
        - paid:
            when: \${ .paid }
            then: end
        - default:
            then: continue
`;

test("a condition is written into its field as jq", () => {
  const action: EditAction = {
    kind: "setCondition",
    pointer: "/do/0/route/switch/0/paid/when",
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
  };

  const outcome = outcomeOf(conditionFlow, action);

  const expected = conditionFlow.replace(
    "when: ${ .paid }",
    'when: ${ .status == "paid" }',
  );
  expect(outcome).toEqual({ text: expected, ids: [], diagnostics: [] });
});

test("a condition that cannot be written is refused with its reason", () => {
  const action: EditAction = {
    kind: "setCondition",
    pointer: "/do/0/route/switch/0/paid/when",
    condition: { join: "all", rows: [] },
  };

  const editing = check(conditionFlow, action);

  expect(editing).toEqual({
    kind: "refused",
    reason: "A condition holds at least one row.",
  });
});
