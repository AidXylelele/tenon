import { expect, test } from "vitest";
import { structureOf } from "../../src/structure.js";
import { analyzer, profile } from "../support/analyzer.js";
import { guardedFlow, unreadable } from "../support/documents.js";

const created = await analyzer;

const options = { profile, imports: {} };

test("a document given as a value has its structure with no ranges", () => {
  const analysis = created.analyze(guardedFlow, options);

  const structure = structureOf(analysis);

  expect(structure).toMatchObject({
    namespace: "test",
    name: "flow",
    steps: {
      id: "/do",
      steps: [
        { id: "/do/greet", range: null, selectionRange: null },
        { id: "/do/guard", range: null, selectionRange: null },
        { id: "/do/route", range: null, selectionRange: null },
      ],
    },
  });
});

test("a document that does not analyse has no structure", () => {
  const analysis = created.analyze(unreadable, options);

  const structure = structureOf(analysis);

  expect(structure).toBeNull();
});
