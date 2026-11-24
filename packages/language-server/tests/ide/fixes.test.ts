import type { Range } from "interpreter/front-end";
import { expect, test } from "vitest";
import { documentOf } from "../../src/ide/document/index.js";
import { fixesAt } from "../../src/ide/fixes/index.js";
import { problemsOf } from "../../src/ide/snapshot/index.js";
import { appliedOf } from "../../src/ide/text/index.js";
import { inlineHeader } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

const readsApiKey = `${inlineHeader}do:
  - a:
      set:
        x: \${ $secrets.apiKey }
`;

const onTheRead: Range = {
  start: { line: 5, column: 12 },
  end: { line: 5, column: 12 },
};

function check(text: string, range: Range) {
  const snapshot = snapshotOf(text);

  return fixesAt(snapshot, range);
}

function fixedTextOf(text: string, range: Range): string {
  const [fix] = check(text, range);

  if (fix === undefined) {
    throw new Error("No fix stands there.");
  }

  return appliedOf(text, fix.changes);
}

test("an undeclared secret has a fix titled by its name", () => {
  const fixes = check(readsApiKey, onTheRead);

  const titles = fixes.map((fix) => fix.title);

  expect(titles).toEqual(["Declare the secret 'apiKey'"]);
});

test("the fix appends the secret to a written list of secrets", () => {
  const listed = `${inlineHeader}use:\n  secrets:\n    - token\ndo:\n  - a:\n      set:\n        x: \${ $secrets.apiKey }\n`;
  const range = {
    start: { line: 8, column: 12 },
    end: { line: 8, column: 12 },
  };

  const fixed = fixedTextOf(listed, range);

  const expected = listed.replace(
    "    - token\n",
    "    - token\n    - apiKey\n",
  );
  expect(fixed).toBe(expected);
});

test("with no use the fix writes one", () => {
  const fixed = fixedTextOf(readsApiKey, onTheRead);

  expect(fixed).toBe(`${readsApiKey}use:\n  secrets:\n    - apiKey\n`);
});

test("a range away from the read has no fix", () => {
  const elsewhere = {
    start: { line: 2, column: 1 },
    end: { line: 2, column: 3 },
  };

  const fixes = check(readsApiKey, elsewhere);

  expect(fixes).toEqual([]);
});

const draft = { namespace: "sales", name: "lead-intake" };

const elsewhere = `document:
  dsl: '1.1.0'
  namespace: orders
  name: greet
  version: '0.1.0'
do:
  - a: { set: { x: 1 } }
`;

const onTheNamespace: Range = {
  start: { line: 3, column: 14 },
  end: { line: 3, column: 14 },
};

test("a document that names another workflow than its draft is a problem", () => {
  const snapshot = { ...snapshotOf(elsewhere), draft };

  const problems = problemsOf(snapshot);
  const reading = documentOf(snapshot);

  expect(problems).toEqual([
    {
      code: "draft-address",
      message:
        "This draft is sales/lead-intake, and the document names orders/greet; publishing it here is refused.",
      pointer: "/document/namespace",
      range: {
        start: { line: 3, column: 14 },
        end: { line: 3, column: 20 },
      },
      subject: "sales/lead-intake",
      import: null,
    },
  ]);
  expect(reading.kind).toBe("refused");
});

test("the address fix writes the draft's namespace and name", () => {
  const snapshot = { ...snapshotOf(elsewhere), draft };

  const [fix] = fixesAt(snapshot, onTheNamespace);
  const fixed = appliedOf(elsewhere, fix?.changes ?? []);

  const expected = elsewhere
    .replace("namespace: orders", "namespace: sales")
    .replace("name: greet", "name: lead-intake");
  expect(fix?.title).toBe("Use sales/lead-intake");
  expect(fixed).toBe(expected);
});
