import { expect, test } from "vitest";
import { rangesOf } from "../../src/ide/document/index.js";
import { refusedGreet } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

function check(text: string, pointers: readonly string[]) {
  const snapshot = snapshotOf(text);

  return rangesOf(snapshot, pointers);
}

test("a text the grammar refuses still places its pointers", () => {
  const pointers = ["/do/0/greet/nope", "/do/0/greet/set/a"];

  const ranges = check(refusedGreet, pointers);

  expect(ranges).toEqual([
    { start: { line: 10, column: 13 }, end: { line: 10, column: 14 } },
    { start: { line: 9, column: 12 }, end: { line: 9, column: 13 } },
  ]);
});
