import type { JsonObject } from "interpreter/front-end";
import { json } from "jq-wasm";
import { expect, test } from "vitest";
import {
  type Condition,
  type ConditionRow,
  conditionOf,
  conditionTextOf,
} from "../../src/ide/conditions/index.js";

const clock = "def now: 1763900000;";

function check(condition: Condition) {
  return conditionTextOf(condition);
}

function textOf(condition: Condition): string {
  const written = check(condition);

  if (written.kind === "refused") {
    throw new Error(written.reason);
  }

  return written.text;
}

async function holdsOn(text: string, data: JsonObject): Promise<unknown> {
  const inner = text.slice("${ ".length, -" }".length);
  const filter = `${clock} ${inner}`;
  const [held] = await json(data, filter);

  return held;
}

function oneRow(row: ConditionRow): Condition {
  return { join: "all", rows: [row] };
}

const contained =
  '.tags | if type == "array" then any(.[]; . == "urgent") elif type == "string" then contains("urgent") else false end';

const rows: readonly (readonly [string, ConditionRow, string])[] = [
  [
    "is a text",
    {
      left: ".status",
      comparison: "is",
      right: { kind: "value", value: "paid" },
    },
    '${ .status == "paid" }',
  ],
  [
    "is not a number",
    { left: ".total", comparison: "isNot", right: { kind: "value", value: 0 } },
    "${ .total != 0 }",
  ],
  [
    "is a yes or no",
    { left: ".done", comparison: "is", right: { kind: "value", value: true } },
    "${ .done == true }",
  ],
  [
    "is other data",
    {
      left: ".id",
      comparison: "is",
      right: { kind: "data", path: "$context.fetch.id" },
    },
    "${ .id == $context.fetch.id }",
  ],
  [
    "contains",
    {
      left: ".tags",
      comparison: "contains",
      right: { kind: "value", value: "urgent" },
    },
    `\${ ${contained} }`,
  ],
  [
    "does not contain",
    {
      left: ".tags",
      comparison: "doesNotContain",
      right: { kind: "value", value: "urgent" },
    },
    `\${ ${contained} | not }`,
  ],
  [
    "is empty",
    { left: ".items", comparison: "isEmpty", right: null },
    '${ .items | . == null or . == "" or . == [] or . == {} }',
  ],
  [
    "is not empty",
    { left: '.["line items"]', comparison: "isNotEmpty", right: null },
    '${ .["line items"] | . != null and . != "" and . != [] and . != {} }',
  ],
  [
    "is greater than a number, read as a number",
    {
      left: ".total",
      comparison: "isGreaterThan",
      right: { kind: "value", value: 10 },
    },
    "${ try ((.total | tonumber) > 10) catch false }",
  ],
  [
    "is greater than a text, in text order",
    {
      left: ".name",
      comparison: "isGreaterThan",
      right: { kind: "value", value: "m" },
    },
    '${ .name > "m" }',
  ],
  [
    "is less than a number, read as a number",
    {
      left: ".total",
      comparison: "isLessThan",
      right: { kind: "value", value: 1.5 },
    },
    "${ try ((.total | tonumber) < 1.5) catch false }",
  ],
  [
    "is less than yesterday",
    {
      left: ".created",
      comparison: "isLessThan",
      right: { kind: "time", time: "yesterday" },
    },
    '${ .created < (now - 86400 | strftime("%Y-%m-%dT00:00:00Z")) }',
  ],
];

test.each(rows)("a row that %s is written in its one form", (_, row, text) => {
  const condition = oneRow(row);

  const written = check(condition);

  expect(written).toEqual({ kind: "text", text });
});

test.each(rows)("a row that %s is read back from its form", (_, row, text) => {
  const condition = oneRow(row);

  const read = conditionOf(text);

  expect(read).toEqual({ kind: "condition", condition });
});

const paidAndFilled: Condition = {
  join: "all",
  rows: [
    {
      left: ".status",
      comparison: "is",
      right: { kind: "value", value: "paid" },
    },
    { left: ".items", comparison: "isNotEmpty", right: null },
  ],
};

const paidOrFilled: Condition = { ...paidAndFilled, join: "any" };

const joined = [
  [
    "all",
    paidAndFilled,
    '${ (.status == "paid") and (.items | . != null and . != "" and . != [] and . != {}) }',
  ],
  [
    "any",
    paidOrFilled,
    '${ (.status == "paid") or (.items | . != null and . != "" and . != [] and . != {}) }',
  ],
] as const;

test.each(joined)(
  "rows joined by %s are written each in brackets",
  (_, condition, text) => {
    const written = check(condition);

    expect(written).toEqual({ kind: "text", text });
  },
);

test.each(joined)(
  "rows joined by %s are read back from their brackets",
  (_, condition, text) => {
    const read = conditionOf(text);

    expect(read).toEqual({ kind: "condition", condition });
  },
);

test.each<readonly [string, ConditionRow, JsonObject, boolean]>([
  [
    "a list holds the value",
    {
      left: ".tags",
      comparison: "contains",
      right: { kind: "value", value: "urgent" },
    },
    { tags: ["urgent", "late"] },
    true,
  ],
  [
    "a text holds the value",
    {
      left: ".tags",
      comparison: "contains",
      right: { kind: "value", value: "urgent" },
    },
    { tags: "very urgent" },
    true,
  ],
  [
    "a list lacks the value",
    {
      left: ".tags",
      comparison: "doesNotContain",
      right: { kind: "value", value: "urgent" },
    },
    { tags: ["late"] },
    true,
  ],
  [
    "a number in a list matches a number",
    {
      left: ".codes",
      comparison: "contains",
      right: { kind: "value", value: 7 },
    },
    { codes: [3, 7] },
    true,
  ],
  [
    "a number holds no text, and is no match rather than a fault",
    {
      left: ".tags",
      comparison: "contains",
      right: { kind: "value", value: "urgent" },
    },
    { tags: 7 },
    false,
  ],
  [
    "a number in a text is found as its digits",
    {
      left: ".code",
      comparison: "contains",
      right: { kind: "value", value: 7 },
    },
    { code: "a7b" },
    true,
  ],
  [
    "zero is not empty",
    { left: ".items", comparison: "isEmpty", right: null },
    { items: 0 },
    false,
  ],
  [
    "a value that is not a number is no match rather than a fault",
    {
      left: ".total",
      comparison: "isGreaterThan",
      right: { kind: "value", value: 10 },
    },
    { total: "many" },
    false,
  ],
  [
    "a missing value is empty",
    { left: ".items", comparison: "isEmpty", right: null },
    {},
    true,
  ],
  [
    "an empty text is empty",
    { left: ".items", comparison: "isEmpty", right: null },
    { items: "" },
    true,
  ],
  [
    "an empty object is empty",
    { left: ".items", comparison: "isEmpty", right: null },
    { items: {} },
    true,
  ],
  [
    "a list with an item is not empty",
    { left: ".items", comparison: "isNotEmpty", right: null },
    { items: [1] },
    true,
  ],
  [
    "a number written as text compares as a number",
    {
      left: ".total",
      comparison: "isGreaterThan",
      right: { kind: "value", value: 10 },
    },
    { total: "5" },
    false,
  ],
  [
    "a time before yesterday is less than yesterday",
    {
      left: ".created",
      comparison: "isLessThan",
      right: { kind: "time", time: "yesterday" },
    },
    { created: "2025-11-21T10:00:00Z" },
    true,
  ],
])("jq runs the written row: %s", async (_, row, data, expected) => {
  const condition = oneRow(row);
  const text = textOf(condition);

  const held = await holdsOn(text, data);

  expect(held).toBe(expected);
});

test.each([
  ["all", paidAndFilled, { status: "paid", items: [] }, false],
  ["any", paidOrFilled, { status: "paid", items: [] }, true],
])("jq runs rows joined by %s", async (_, condition, data, expected) => {
  const text = textOf(condition);

  const held = await holdsOn(text, data);

  expect(held).toBe(expected);
});

test.each([
  ["spaced otherwise", '${ .status=="paid" }'],
  ["one row in brackets", '${ (.status == "paid") }'],
  ["rows joined with no brackets", "${ .a == 1 and .b == 2 }"],
  ["rows joined by both", "${ (.a == 1) and (.b == 2) or (.c == 3) }"],
  ["another filter", '${ .name | test("^A") }'],
  ["a comparison of two literals", "${ 1 == 1 }"],
  ["a number compared in text order", "${ .total > 10 }"],
  [
    "a contains whose two values differ",
    '${ .tags | if type == "array" then any(.[]; . == "a") elif type == "string" then contains("b") else false end }',
  ],
  ["a text with no expression", "true"],
  ["a bare filter", '.status == "paid"'],
])("a hand-written expression stays an expression: %s", (_, text) => {
  const read = conditionOf(text);

  expect(read).toEqual({ kind: "expression" });
});

test.each<readonly [string, Condition, string]>([
  [
    "a condition with no row",
    { join: "all", rows: [] },
    "A condition holds at least one row.",
  ],
  [
    "a first value that is not data",
    oneRow({ left: "status", comparison: "isEmpty", right: null }),
    "'status' is not a path to data.",
  ],
  [
    "a second value that is not data",
    oneRow({
      left: ".a",
      comparison: "is",
      right: { kind: "data", path: "now" },
    }),
    "'now' is not a path to data.",
  ],
])("%s is refused", (_, condition, reason) => {
  const written = check(condition);

  expect(written).toEqual({ kind: "refused", reason });
});

test("an empty condition is read as a condition with no row yet", () => {
  const read = conditionOf("");

  expect(read).toEqual({
    kind: "condition",
    condition: { join: "all", rows: [] },
  });
});
