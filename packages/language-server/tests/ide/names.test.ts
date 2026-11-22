import type { Imports } from "interpreter/front-end";
import { expect, test } from "vitest";
import { appliedOf } from "../../src/ide/text/index.js";
import { definitionAt, renameAt, usesAt } from "../../src/ide/names/index.js";
import {
  countdownFlow,
  guardedFlow,
  inlineHeader,
  logText,
  orderFlow,
  U,
  uriFlow,
} from "../support/documents.js";
import { fixtureOf } from "../support/fixture.js";
import { snapshotAfter, snapshotOf } from "../support/snapshot.js";

const rejectedFlow = guardedFlow.replace(
  "message: hello",
  "message: hello\n      nope: 1",
);

const secretFlow = `document: { dsl: '1.1.0', namespace: test, name: flow, version: '0.1.0' }
use:
  secrets: [ api‸Key ]
do:
  - a: { set: { x: 1 } }
`;

const listenFlow = `${inlineHeader}do:
  - gossip:
      listen:
        to:
          any: []
          until: '\${ false }'
      foreach:
        item: event
        do:
          - note:
              set:
                kind: \${ $event.type }
`;

const defaultErrorFlow = `${inlineHeader}do:
  - guard:
      try:
        - fetch:
            call: http
            with:
              method: get
              endpoint: https://example.com
      catch:
        do:
          - note:
              set:
                status: \${ $err‸or.status }
`;

const surrogateLabels = `document: { dsl: '1.1.0', namespace: test, name: flow, version: '0.1.0' }
do:
  - a: { set: { x: '𐐀' }, then: b }
  - b: { set: { y: 1 } }
`;

function definitionIn(marked: string, basis: string | null = null) {
  const { text, cursor } = fixtureOf(marked);
  const snapshot =
    basis === null ? snapshotOf(text) : snapshotAfter(basis, text);

  return definitionAt(snapshot, cursor);
}

function usesIn(marked: string) {
  const { text, cursor } = fixtureOf(marked);
  const snapshot = snapshotOf(text);

  return usesAt(snapshot, cursor);
}

function renamingIn(marked: string, name: string, imports: Imports = {}) {
  const { text, cursor } = fixtureOf(marked);
  const snapshot = snapshotOf(text, imports);

  return renameAt(snapshot, cursor, name);
}

function renamedIn(marked: string, name: string): string {
  const { text } = fixtureOf(marked);
  const renaming = renamingIn(marked, name);

  if (renaming.kind === "refused") {
    throw new Error(renaming.reason);
  }

  return appliedOf(text, renaming.changes);
}

test("a label goes to its step's name", () => {
  const marked = guardedFlow.replace("then: guard", "then: gu‸ard");

  const definition = definitionIn(marked);

  expect(definition).toEqual({
    start: { line: 10, column: 5 },
    end: { line: 10, column: 10 },
  });
});

test("a label read at its end still goes to its step's name", () => {
  const marked = guardedFlow.replace("then: guard", "then: guard‸");

  const definition = definitionIn(marked);

  expect(definition).toEqual({
    start: { line: 10, column: 5 },
    end: { line: 10, column: 10 },
  });
});

test("a call goes to its function's declaration", () => {
  const marked = countdownFlow.replace(
    "call: countdown\n  - again",
    "call: count‸down\n  - again",
  );

  const definition = definitionIn(marked);

  expect(definition).toEqual({
    start: { line: 8, column: 5 },
    end: { line: 8, column: 14 },
  });
});

test("a function's uses are its calls", () => {
  const marked = countdownFlow.replace("    countdown:", "    count‸down:");

  const uses = usesIn(marked);

  expect(uses).toEqual([
    { start: { line: 13, column: 13 }, end: { line: 13, column: 22 } },
    { start: { line: 15, column: 13 }, end: { line: 15, column: 22 } },
  ]);
});

test("a task's uses are the labels naming it, counted in UTF-16 units", () => {
  const marked = surrogateLabels.replace("  - b:", "  - ‸b:");

  const uses = usesIn(marked);

  expect(uses).toEqual([
    { start: { line: 3, column: 34 }, end: { line: 3, column: 35 } },
  ]);
});

test("renaming a task renames its labels and nothing else", () => {
  const commented = guardedFlow.replace(
    "then: guard",
    "then: guard  # keep me",
  );
  const marked = commented.replace("- guard:", "- gu‸ard:");

  const renamed = renamedIn(marked, "shield");

  const expected = commented
    .replace("- guard:", "- shield:")
    .replace("then: guard", "then: shield");
  expect(renamed).toBe(expected);
  const analysis = snapshotOf(renamed).analysis;
  expect(analysis).toMatchObject({ kind: "analyzed", diagnostics: [] });
});

test("renaming a function renames its calls", () => {
  const marked = countdownFlow.replace("    countdown:", "    count‸down:");

  const renamed = renamedIn(marked, "tick");

  const expected = countdownFlow.replaceAll("countdown", "tick");
  expect(renamed).toBe(expected);
});

test.each([
  [
    "a name a sibling has",
    guardedFlow.replace("- guard:", "- gu‸ard:"),
    "greet",
    {},
    "A step named 'greet' already stands in this list.",
  ],
  [
    "a flow directive as the new name",
    guardedFlow.replace("- guard:", "- gu‸ard:"),
    "end",
    {},
    "'end' is a flow directive, not a name.",
  ],
  [
    "an empty name",
    guardedFlow.replace("- guard:", "- gu‸ard:"),
    "",
    {},
    "A name cannot be empty.",
  ],
  [
    "a flow directive at the cursor",
    guardedFlow.replace("then: end", "then: e‸nd"),
    "stop",
    {},
    "'end' is a flow directive, not a name.",
  ],
  [
    "a member, which is no name",
    guardedFlow.replace("message: hello", "mes‸sage: hello"),
    "note",
    {},
    "Nothing here can be renamed.",
  ],
  [
    "a secret",
    secretFlow,
    "token",
    {},
    "A secret cannot be renamed here: expressions name it too.",
  ],
  [
    "an imported function",
    uriFlow.replace(
      `call: ${U}\n      with:\n        message: hello`,
      `call: ‸${U}\n      with:\n        message: hello`,
    ),
    "log",
    { [U]: logText },
    "An imported function is renamed in its catalog.",
  ],
  [
    "a loop's item to a runtime argument's name",
    orderFlow.replace("${ $order.price }", "${ $or‸der.price }"),
    "input",
    {},
    "'input' is a runtime argument.",
  ],
  [
    "a loop's item to a name in its scope",
    orderFlow.replace("${ $order.price }", "${ $or‸der.price }"),
    "index",
    {},
    "A name 'index' is already in scope here.",
  ],
  [
    "a loop's item to what no expression can read",
    orderFlow.replace("${ $order.price }", "${ $or‸der.price }"),
    "a b",
    {},
    "'a b' is not a name an expression can read.",
  ],
  [
    "a caught error named by default",
    defaultErrorFlow,
    "failure",
    {},
    "'error' is the default name here; write it in the text to rename it.",
  ],
  [
    "a document that does not analyse",
    rejectedFlow.replace("- guard:", "- gu‸ard:"),
    "shield",
    {},
    "The document does not analyse; fix it before renaming.",
  ],
])("a rename of %s is refused", (_, marked, name, imports, reason) => {
  const renaming = renamingIn(marked, name, imports);

  expect(renaming).toEqual({ kind: "refused", reason });
});

test("on rejected text a label still goes to its step while the key reads its name", () => {
  const marked = rejectedFlow.replace("then: guard", "then: gu‸ard");

  const definition = definitionIn(marked, guardedFlow);

  expect(definition).toEqual({
    start: { line: 11, column: 5 },
    end: { line: 11, column: 10 },
  });
});

test("on rejected text a label goes nowhere once its step is retyped", () => {
  const retyped = rejectedFlow.replace("- guard:", "- guar:");
  const marked = retyped.replace("then: guard", "then: gu‸ard");

  const definition = definitionIn(marked, guardedFlow);

  expect(definition).toBeNull();
});

test("a text that does not read has no names", () => {
  const marked = "do: [‸\n";

  const definition = definitionIn(marked);
  const uses = usesIn(marked);

  expect(definition).toBeNull();
  expect(uses).toEqual([]);
});

test("a loop's item in an expression goes to its declaration", () => {
  const marked = orderFlow.replace("${ $order.price }", "${ $or‸der.price }");

  const definition = definitionIn(marked);

  expect(definition).toEqual({
    start: { line: 6, column: 15 },
    end: { line: 6, column: 20 },
  });
});

test("a listen's item in an expression goes to its declaration", () => {
  const marked = listenFlow.replace("$event.type", "$ev‸ent.type");

  const definition = definitionIn(marked);

  expect(definition).toEqual({
    start: { line: 9, column: 15 },
    end: { line: 9, column: 20 },
  });
});

test("a loop's item is used where its expressions read it", () => {
  const marked = orderFlow.replace("${ $order.price }", "${ $or‸der.price }");

  const uses = usesIn(marked);

  expect(uses).toEqual([
    { start: { line: 10, column: 23 }, end: { line: 10, column: 29 } },
    { start: { line: 11, column: 27 }, end: { line: 11, column: 33 } },
  ]);
});

test("renaming a loop's item renames its declaration and every read", () => {
  const marked = orderFlow.replace("${ $order.price }", "${ $or‸der.price }");

  const renamed = renamedIn(marked, "line");

  const expected = orderFlow
    .replace("each: order", "each: line")
    .replaceAll("$order", "$line");
  expect(renamed).toBe(expected);
  const analysis = snapshotOf(renamed).analysis;
  expect(analysis).toMatchObject({ kind: "analyzed", diagnostics: [] });
});

test("a loop's item is renamed from its declaration too", () => {
  const marked = orderFlow.replace("each: order", "each: or‸der");

  const renamed = renamedIn(marked, "line");

  const expected = orderFlow
    .replace("each: order", "each: line")
    .replaceAll("$order", "$line");
  expect(renamed).toBe(expected);
});
