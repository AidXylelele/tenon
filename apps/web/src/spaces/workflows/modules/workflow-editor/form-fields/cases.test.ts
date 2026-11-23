import type { FormField } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import {
  caseAdditionOf,
  caseMoveOf,
  caseRemovalOf,
  casesOf,
  otherwiseEditsOf,
  thenEditsOf,
  whenPointerOf,
} from "./cases";

const POINTER = "/do/1/Has items/switch";

const WHEN = "${ .items | length > 0 }";

const ROUTES: FormField["value"] = [
  { "Has items": { when: WHEN, then: "continue" } },
  { Big: { when: "${ .big }" } },
  { default: { then: "end" } },
];

const ROUTED = {
  pointer: POINTER,
  required: true,
  written: true,
  value: ROUTES,
};

const ALONE: FormField["value"] = [
  { "Has items": { when: WHEN, then: "continue" } },
];

const NO_OTHERWISE = { ...ROUTED, value: ALONE };

const HAS_ITEMS = {
  index: 0,
  name: "Has items",
  when: WHEN,
  then: "continue",
  isOtherwise: false,
};

const BIG = {
  index: 1,
  name: "Big",
  when: "${ .big }",
  then: "continue",
  isOtherwise: false,
};

const OTHERWISE = {
  index: 2,
  name: "default",
  when: null,
  then: "end",
  isOtherwise: true,
};

describe("the branches of a switch", () => {
  it("each_case_is_a_row_and_a_case_without_a_condition_is_otherwise", () => {
    const rows = casesOf(ROUTES);

    expect(rows).toEqual([HAS_ITEMS, BIG, OTHERWISE]);
  });

  it.each([
    ["an_expression", "${ .cases }"],
    ["a_case_of_two_names", [{ a: {}, b: {} }]],
    ["a_case_that_is_not_an_object", ["a"]],
    ["a_case_whose_body_is_not_an_object", [{ a: "b" }]],
  ])("%s_is_not_read_as_branches", (_, value) => {
    const rows = casesOf(value);

    expect(rows).toBeNull();
  });

  it("a_condition's_pointer_is_below_its_case", () => {
    const pointer = whenPointerOf(POINTER, HAS_ITEMS);

    expect(pointer).toBe(`${POINTER}/0/Has items/when`);
  });
});

describe("changing the branches", () => {
  it("a_branch's_destination_is_set_at_its_then", () => {
    const edits = thenEditsOf(ROUTED, BIG, "end");

    expect(edits).toEqual([
      { kind: "setField", pointer: `${POINTER}/1/Big/then`, value: "end" },
    ]);
  });

  it("the_same_destination_sends_nothing", () => {
    const edits = thenEditsOf(ROUTED, BIG, "continue");

    expect(edits).toEqual([]);
  });

  it("otherwise_sets_the_then_of_its_case", () => {
    const edits = otherwiseEditsOf(ROUTED, "Totals");

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: `${POINTER}/2/default/then`,
        value: "Totals",
      },
    ]);
  });

  it("otherwise_with_no_case_writes_one_unless_it_continues", () => {
    const written = otherwiseEditsOf(NO_OTHERWISE, "end");
    const unwritten = otherwiseEditsOf(NO_OTHERWISE, "continue");

    expect([written, unwritten]).toEqual([
      [
        {
          kind: "setField",
          pointer: POINTER,
          value: [
            { "Has items": { when: WHEN, then: "continue" } },
            { default: { then: "end" } },
          ],
        },
      ],
      [],
    ]);
  });

  it("a_new_branch_goes_before_otherwise_with_a_condition_to_fill", () => {
    const edits = caseAdditionOf(ROUTED);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: POINTER,
        value: [
          { "Has items": { when: WHEN, then: "continue" } },
          { Big: { when: "${ .big }" } },
          { "branch-1": { when: "", then: "continue" } },
          { default: { then: "end" } },
        ],
      },
    ]);
  });

  it("a_new_branch_without_otherwise_goes_last", () => {
    const edits = caseAdditionOf(NO_OTHERWISE);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: POINTER,
        value: [
          { "Has items": { when: WHEN, then: "continue" } },
          { "branch-1": { when: "", then: "continue" } },
        ],
      },
    ]);
  });

  it("moving_a_branch_swaps_it_with_its_neighbour", () => {
    const edits = caseMoveOf(ROUTED, BIG, -1);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: POINTER,
        value: [
          { Big: { when: "${ .big }" } },
          { "Has items": { when: WHEN, then: "continue" } },
          { default: { then: "end" } },
        ],
      },
    ]);
  });

  it("moving_past_the_end_sends_nothing", () => {
    const edits = caseMoveOf(ROUTED, OTHERWISE, 1);

    expect(edits).toEqual([]);
  });

  it("removing_a_branch_keeps_the_others", () => {
    const edits = caseRemovalOf(ROUTED, BIG);

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: POINTER,
        value: [
          { "Has items": { when: WHEN, then: "continue" } },
          { default: { then: "end" } },
        ],
      },
    ]);
  });
});
