import { describe, expect, it } from "vitest";
import { COMPARISONS, literalOf, literalText, secondOf } from "./words";

describe("the words of comparisons", () => {
  it("are_the_design's_in_its_order", () => {
    const words = COMPARISONS.map((each) => each.words);

    expect(words).toEqual([
      "is not empty",
      "is empty",
      "is",
      "is not",
      "contains",
      "does not contain",
      "is greater than",
      "is less than",
    ]);
  });

  it.each([
    ["isEmpty", "none"],
    ["contains", "value"],
    ["is", "operand"],
  ] as const)("%s_takes_%s_as_its_second_value", (comparison, expected) => {
    const second = secondOf(comparison);

    expect(second).toBe(expected);
  });
});

describe("a typed second value", () => {
  it.each([
    ["paid", "paid"],
    ["200", 200],
    ["-1.5", -1.5],
    ["true", true],
    ["null", null],
    ['"200"', "200"],
    ['"a', '"a'],
  ])("%s_reads_as_%s", (text, expected) => {
    const typed = literalOf(text, "is");

    expect(typed).toEqual({ kind: "literal", value: expected });
  });

  it("an_empty_value_is_refused", () => {
    const typed = literalOf("  ", "is");

    expect(typed).toEqual({ kind: "refused", reason: "Enter a value." });
  });

  it("ordering_needs_a_number", () => {
    const typed = literalOf("many", "isLessThan");

    expect(typed).toEqual({ kind: "refused", reason: "Enter a number." });
  });

  it.each([
    ["paid", "paid"],
    [200, "200"],
    [false, "false"],
    [null, "null"],
    ["200", '"200"'],
    ["true", '"true"'],
  ] as const)("%s_is_shown_as_%s", (value, expected) => {
    const text = literalText(value);

    expect(text).toBe(expected);
  });
});
