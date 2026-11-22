import { expect, test } from "vitest";
import { hoverAt } from "../../src/ide/hover/index.js";
import { analyzer } from "../support/analyzer.js";
import {
  countdownFlow,
  guardedFlow,
  inlineHeader,
  orderFlow,
} from "../support/documents.js";
import { fixtureOf } from "../support/fixture.js";
import { snapshotOf } from "../support/snapshot.js";

const created = await analyzer;

const schemasAt = created.schemasAt.bind(created);

function check(marked: string) {
  const { text, cursor } = fixtureOf(marked);
  const snapshot = snapshotOf(text);

  return hoverAt(snapshot, cursor, schemasAt);
}

const markdownNamed = [
  "document: { dsl: '1.1.0', namespace: test, name: flow, version: '0.1.0' }",
  "do:",
  '  - "<img onerror=x>`":',
  "      set:",
  "        a: 1",
  "  - jump:",
  "      set:",
  "        b: 2",
  '      then: "<im‸g onerror=x>`"',
  "",
].join("\n");

test("a member shows its description from the grammar", () => {
  const marked = guardedFlow.replace("then: guard", "th‸en: guard");

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 26, column: 13 }, end: { line: 26, column: 17 } },
    markdown:
      "**then**\n\nThe flow directive to execute when the case matches.",
  });
});

test("a call and its kind show the call the task performs", () => {
  const onKey = guardedFlow.replace("call: http", "ca‸ll: http");
  const onKind = guardedFlow.replace("call: http", "call: ht‸tp");

  const keyHover = check(onKey);
  const kindHover = check(onKind);

  expect(keyHover?.markdown).toBe(
    "**call**\n\nDefines the HTTP call to perform.",
  );
  expect(kindHover?.markdown).toBe(
    "**call**\n\nDefines the HTTP call to perform.",
  );
});

test("a reference shows its component as written", () => {
  const marked = countdownFlow.replace(
    "call: countdown\n  - again",
    "call: count‸down\n  - again",
  );

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 13, column: 13 }, end: { line: 13, column: 22 } },
    markdown:
      "**function** `countdown`\n\n```yaml\ncountdown:\n  set:\n    left: 3\n```",
  });
});

test("a label shows the step it names", () => {
  const marked = guardedFlow.replace("then: guard", "then: gu‸ard");

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 26, column: 19 }, end: { line: 26, column: 24 } },
    markdown: "**try** `guard`",
  });
});

test("a name with Markdown in it stays inside a code span", () => {
  const hover = check(markdownNamed);

  expect(hover).toEqual({
    range: { start: { line: 9, column: 13 }, end: { line: 9, column: 31 } },
    markdown: "**set** `` <img onerror=x>` ``",
  });
});

test("a text that does not read shows nothing", () => {
  const hover = check("do: [‸\n");

  expect(hover).toBeNull();
});

test("a key of a text the grammar refuses still shows its description", () => {
  const refused = guardedFlow.replace(
    "message: hello",
    "message: hello\n      nope: 1",
  );
  const marked = refused.replace(
    "      set:\n        message",
    "      se‸t:\n        message",
  );

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 8, column: 7 }, end: { line: 8, column: 10 } },
    markdown: "**set**\n\nThe data to set.",
  });
});

test("a label after a surrogate pair is placed in UTF-16 units", () => {
  const marked = `${inlineHeader}do:\n  - a: { set: { x: '𐐀' }, then: ‸b }\n  - b: { set: { y: 1 } }\n`;

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 3, column: 34 }, end: { line: 3, column: 35 } },
    markdown: "**set** `b`",
  });
});

test("a loop's item in an expression shows its binding", () => {
  const marked = orderFlow.replace("${ $order.price }", "${ $or‸der.price }");

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 10, column: 23 }, end: { line: 10, column: 29 } },
    markdown: "**loop item** `$order`",
  });
});

test("a runtime argument in an expression shows its binding", () => {
  const marked = orderFlow.replace("$order.price", "$sec‸rets.key");

  const hover = check(marked);

  expect(hover).toEqual({
    range: { start: { line: 10, column: 23 }, end: { line: 10, column: 31 } },
    markdown: "**runtime argument** `$secrets`",
  });
});
