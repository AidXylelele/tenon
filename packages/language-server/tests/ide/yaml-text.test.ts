import { expect, test } from "vitest";
import {
  inlineYamlOf,
  scalarLike,
  yamlOf,
} from "../../src/ide/yaml-text/index.js";
import { greetValue } from "../support/documents.js";

test("a long expression is not folded", () => {
  const expression = "${ " + "x".repeat(120) + " }";
  const value = {
    document: greetValue.document,
    do: [{ greet: { set: { x: expression } } }],
  };

  const text = yamlOf(value);

  const lines = text.split("\n");
  expect(lines).toHaveLength(10);
  const holding = lines.filter((line) => line.includes(expression));
  expect(holding).toHaveLength(1);
});

test.each([
  ["a plain name stays plain", "guard", "shield", "shield"],
  ["a double-quoted name stays double-quoted", '"guard"', "shield", '"shield"'],
  ["a single-quoted name stays single-quoted", "'guard'", "shield", "'shield'"],
  [
    "a plain name that would not read back is quoted",
    "guard",
    "a: b",
    '"a: b"',
  ],
])("%s", (_, written, value, expected) => {
  const scalar = scalarLike(written, value);

  expect(scalar).toBe(expected);
});

test("a value is written on one line", () => {
  const value = { wait: { wait: "PT1S" }, note: "two\nlines" };

  const text = inlineYamlOf(value);

  expect(text).toBe('{ "wait": { "wait": "PT1S" }, "note": "two\\nlines" }');
});
