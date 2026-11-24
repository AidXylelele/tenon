import { standardVersion } from "interpreter/front-end";
import { expect, test } from "vitest";
import { newDocumentOf } from "../../src/ide/document/index.js";
import { analyzer, profile } from "../support/analyzer.js";

const created = await analyzer;

const options = { profile, imports: {} };

function check(namespace: string, name: string, version: string) {
  const header = { namespace, name, version };
  const analyze = (text: string) => created.analyze(text, options);

  return newDocumentOf(header, analyze);
}

test("its text reads back with no diagnostic", () => {
  const reading = check("sales", "onboarding", "1.0.0");
  const text = reading.kind === "text" ? reading.text : "";

  const analysis = created.analyze(text, options);

  expect(analysis).toMatchObject({
    kind: "analyzed",
    diagnostics: [],
    model: {
      source: {
        document: {
          document: {
            dsl: standardVersion,
            namespace: "sales",
            name: "onboarding",
            version: "1.0.0",
          },
          do: [],
        },
      },
    },
  });
});

test("a name YAML would read as a number stays a string", () => {
  const reading = check("sales", "123", "1.0.0");

  expect(reading).toMatchObject({ kind: "text" });
  expect(reading).toHaveProperty(
    "text",
    expect.stringContaining('name: "123"'),
  );
});

test("values the grammar does not admit are named, in order", () => {
  const reading = check("Sales Team", "on boarding", "one");

  expect(reading).toEqual({
    kind: "refused",
    params: ["namespace", "name", "version"],
  });
});
