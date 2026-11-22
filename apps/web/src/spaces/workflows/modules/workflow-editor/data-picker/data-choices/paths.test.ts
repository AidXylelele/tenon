import { describe, expect, it } from "vitest";
import { isPath, memberPathOf, typedNamesOf, valueOf } from "./paths";
import { sampleMembersOf, shapeOf } from "./samples";

describe("paths into data", () => {
  it.each([
    [".", "items", ".items"],
    [".", "a name", '.["a name"]'],
    ["$context.fetch", "items", "$context.fetch.items"],
    ['$context["Fetch the digest"]', "0", '$context["Fetch the digest"]["0"]'],
  ])("%s_and_%s_give_%s", (base, name, expected) => {
    const path = memberPathOf(base, name);

    expect(path).toBe(expected);
  });

  it.each([
    [".", true],
    [".items", true],
    ['$context["Fetch the digest"].items', true],
    ["$workflow.input", true],
    ["now | todate", false],
    ["", false],
  ])("%s_is_a_path_%s", (expression, expected) => {
    const path = isPath(expression);

    expect(path).toBe(expected);
  });

  it("a_value_holds_its_expression", () => {
    const value = valueOf(".items");

    expect(value).toBe("${ .items }");
  });

  it.each([
    ["items", ["items"]],
    [" slideshow.slides ", ["slideshow", "slides"]],
    ["a b", null],
    ["", null],
  ])("typed_%s_names_%s", (typed, expected) => {
    const names = typedNamesOf(typed);

    expect(names).toEqual(expected);
  });
});

describe("the fields of a sample", () => {
  it("follow_its_objects_three_levels_deep", () => {
    const members = sampleMembersOf(".", { a: { b: { c: { d: 1 } } } });

    const deepest = members[0]?.members[0]?.members[0];

    expect(deepest).toMatchObject({ expression: ".a.b.c", members: [] });
  });

  it.each([
    [[1], "list"],
    ["a", "text"],
    [1, "number"],
    [true, "boolean"],
    [null, "unknown"],
    [{}, "object"],
  ] as const)("%s_is_%s", (sample, expected) => {
    const shape = shapeOf(sample);

    expect(shape).toBe(expected);
  });
});
