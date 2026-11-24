import { expect, test } from "vitest";

test("the protocol entry holds names, not code", async () => {
  const entry = await import("../../src/protocol/index.js");

  const names = Object.keys(entry).toSorted();
  expect(names).toEqual(["methods", "stepFamilies"]);
});
