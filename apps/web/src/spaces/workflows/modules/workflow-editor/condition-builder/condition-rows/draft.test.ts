import type { Condition } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import {
  conditionOf,
  draftOf,
  editsOf,
  holdsReading,
  rowProblemOf,
  settledOf,
  withComparison,
  withJoin,
  withLeft,
  withRight,
  withRowAdded,
  withRowRemoved,
  writtenPartOf,
} from "./draft";

const POINTER = "/do/1/route/switch/0/paid/when";

const PAID: Condition = {
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

const EMPTY: Condition = { join: "all", rows: [] };

const GREET = { step: "/do/Greet", value: "${ $context.Greet }" };

describe("a condition opened in the builder", () => {
  it("each_row_keeps_its_value_comparison_and_second_value", () => {
    const draft = draftOf(PAID);

    expect(draft.rows).toEqual([
      {
        id: 0,
        left: ".status",
        comparison: "is",
        right: { kind: "value", text: "paid" },
      },
      {
        id: 1,
        left: ".items",
        comparison: "isNotEmpty",
        right: { kind: "none" },
      },
    ]);
  });

  it("no_condition_yet_opens_with_one_row_to_fill", () => {
    const draft = draftOf(EMPTY);

    expect(draft.rows).toEqual([
      { id: 0, left: null, comparison: "isNotEmpty", right: { kind: "none" } },
    ]);
  });

  it("data_and_times_on_the_right_are_kept", () => {
    const condition: Condition = {
      join: "any",
      rows: [
        { left: ".a", comparison: "is", right: { kind: "data", path: ".b" } },
        {
          left: ".at",
          comparison: "isLessThan",
          right: { kind: "time", time: "today" },
        },
      ],
    };

    const written = conditionOf(draftOf(condition));

    expect(written).toEqual(condition);
  });

  it("a_whole_condition_reads_back_as_itself", () => {
    const written = conditionOf(draftOf(PAID));

    expect(written).toEqual(PAID);
  });
});

describe("changing the rows", () => {
  it("a_row_without_its_value_is_not_written_yet", () => {
    const draft = withRowAdded(draftOf(PAID));

    const written = conditionOf(draft);

    expect(written).toBeNull();
    const writtenPart = writtenPartOf(draft);
    expect(writtenPart).toEqual(PAID);
  });

  it("choosing_the_value_of_a_new_row_completes_it", () => {
    const draft = withLeft(draftOf(EMPTY), 0, ".total", null);

    const written = conditionOf(draft);

    expect(written).toEqual({
      join: "all",
      rows: [{ left: ".total", comparison: "isNotEmpty", right: null }],
    });
  });

  it("a_comparison_that_needs_a_number_takes_one", () => {
    const opened = draftOf(PAID);
    const greater = withComparison(opened, 0, "isGreaterThan");
    const typed = withRight(greater, 0, { kind: "value", text: "100" }, null);

    const condition = conditionOf(typed);

    expect(condition?.rows[0]).toEqual({
      left: ".status",
      comparison: "isGreaterThan",
      right: { kind: "value", value: 100 },
    });
  });

  it("a_number_comparison_with_text_says_to_enter_a_number", () => {
    const greater = withComparison(draftOf(PAID), 0, "isGreaterThan");

    const problems = greater.rows.map(rowProblemOf);

    expect(problems).toEqual(["Enter a number.", null]);
    const condition = conditionOf(greater);
    expect(condition).toBeNull();
  });

  it("an_empty_second_value_waits_without_a_problem", () => {
    const contains = withComparison(draftOf(PAID), 1, "contains");

    const problems = contains.rows.map(rowProblemOf);

    expect(contains.rows[1]?.right).toEqual({ kind: "value", text: "" });
    expect(problems).toEqual([null, null]);
  });

  it("data_not_chosen_yet_waits", () => {
    const pending = withRight(
      draftOf(PAID),
      0,
      { kind: "data", path: null },
      null,
    );

    const condition = conditionOf(pending);
    expect(condition).toBeNull();
  });

  it("emptiness_needs_no_second_value", () => {
    const empty = withComparison(draftOf(PAID), 0, "isEmpty");

    expect(empty.rows[0]?.right).toEqual({ kind: "none" });
  });

  it("contains_keeps_a_typed_value_and_drops_data", () => {
    const data = withRight(
      draftOf(PAID),
      0,
      { kind: "data", path: ".b" },
      null,
    );
    const kept = withComparison(draftOf(PAID), 0, "contains");
    const dropped = withComparison(data, 0, "contains");

    expect(kept.rows[0]?.right).toEqual({ kind: "value", text: "paid" });
    expect(dropped.rows[0]?.right).toEqual({ kind: "value", text: "" });
  });

  it("contains_writes_a_value", () => {
    const contains = withComparison(draftOf(PAID), 0, "doesNotContain");

    const condition = conditionOf(contains);

    expect(condition?.rows[0]).toEqual({
      left: ".status",
      comparison: "doesNotContain",
      right: { kind: "value", value: "paid" },
    });
  });

  it("removing_the_last_row_leaves_one_to_fill", () => {
    const one = draftOf(EMPTY);

    const draft = withRowRemoved(one, 0);

    expect(draft.rows).toEqual([
      { id: 1, left: null, comparison: "isNotEmpty", right: { kind: "none" } },
    ]);
  });

  it("removing_a_row_keeps_the_others", () => {
    const draft = withRowRemoved(draftOf(PAID), 0);

    const condition = conditionOf(draft)?.rows;
    expect(condition).toEqual([PAID.rows[1]]);
  });

  it("any_joins_the_rows_by_or", () => {
    const draft = withJoin(draftOf(PAID), "any");

    const condition = conditionOf(draft)?.join;
    expect(condition).toBe("any");
  });
});

describe("the edits a condition sends", () => {
  it("a_whole_condition_is_set_at_its_field", () => {
    const edits = editsOf(POINTER, draftOf(PAID));

    expect(edits).toEqual([
      { kind: "setCondition", pointer: POINTER, condition: PAID },
    ]);
  });

  it("data_read_through_the_context_exports_its_step_first", () => {
    const draft = withLeft(draftOf(EMPTY), 0, "$context.Greet", GREET);

    const edits = editsOf(POINTER, draft);

    expect(edits).toEqual([
      {
        kind: "useData",
        pointer: POINTER,
        value: "${ $context.Greet }",
        export: "/do/Greet",
      },
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: {
          join: "all",
          rows: [
            { left: "$context.Greet", comparison: "isNotEmpty", right: null },
          ],
        },
      },
    ]);
  });

  it("a_settled_draft_exports_nothing_again", () => {
    const draft = withRight(
      draftOf(PAID),
      0,
      { kind: "data", path: "$context.Greet" },
      GREET,
    );

    const edits = editsOf(POINTER, settledOf(draft));

    expect(edits).toHaveLength(1);
  });

  it("an_incomplete_condition_sends_nothing", () => {
    const edits = editsOf(POINTER, draftOf(EMPTY));

    expect(edits).toEqual([]);
  });
});

describe("whether a reading is what the builder holds", () => {
  it("the_written_rows_of_the_draft_hold_it", () => {
    const draft = withRowAdded(draftOf(PAID));

    const holds = holdsReading(draft, { kind: "condition", condition: PAID });

    expect(holds).toBe(true);
  });

  it("another_condition_or_an_expression_is_not_held", () => {
    const draft = draftOf(PAID);

    const other = holdsReading(draft, { kind: "condition", condition: EMPTY });
    const expression = holdsReading(draft, { kind: "expression" });

    expect([other, expression]).toEqual([false, false]);
  });
});
