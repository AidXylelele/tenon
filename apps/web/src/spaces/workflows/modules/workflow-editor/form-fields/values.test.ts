import { describe, expect, it } from "vitest";
import {
  additionOf,
  memberPointerOf,
  removalOf,
  renameCommitOf,
  rowsOf,
} from "./values";

const POINTER = "/do/3/Totals/set";

const TOTALS = {
  pointer: POINTER,
  required: true,
  written: true,
  value: { total: "${ 1 }", count: 2 },
};

const NO_ARGUMENTS = {
  pointer: "/do/4/run/script/arguments",
  required: false,
  written: false,
  value: null,
};

describe("the rows of named values", () => {
  it("an_object_gives_one_row_per_member_in_order", () => {
    const rows = rowsOf(TOTALS.value);

    expect(rows).toEqual([
      { name: "total", value: "${ 1 }" },
      { name: "count", value: 2 },
    ]);
  });

  it("nothing_written_gives_no_rows", () => {
    const rows = rowsOf(null);

    expect(rows).toEqual([]);
  });

  it("an_expression_has_no_rows", () => {
    const rows = rowsOf("${ .totals }");

    expect(rows).toBeNull();
  });

  it("a_member's_pointer_escapes_its_name", () => {
    const pointer = memberPointerOf(POINTER, "a/b~c");

    expect(pointer).toBe(`${POINTER}/a~1b~0c`);
  });
});

describe("changing the named values", () => {
  it("renaming_keeps_the_order_and_the_value", () => {
    const commit = renameCommitOf(TOTALS, "total", " sum ");

    expect(commit).toEqual({
      kind: "edits",
      edits: [
        {
          kind: "setField",
          pointer: POINTER,
          value: { sum: "${ 1 }", count: 2 },
        },
      ],
    });
  });

  it("the_same_name_sends_nothing", () => {
    const commit = renameCommitOf(TOTALS, "total", "total");

    expect(commit).toEqual({ kind: "edits", edits: [] });
  });

  it("an_empty_name_is_refused", () => {
    const commit = renameCommitOf(TOTALS, "total", " ");

    expect(commit).toEqual({
      kind: "refused",
      reason: "Give the value a name.",
    });
  });

  it("a_taken_name_is_refused", () => {
    const commit = renameCommitOf(TOTALS, "total", "count");

    expect(commit).toEqual({
      kind: "refused",
      reason: "Another value is already named “count”.",
    });
  });

  it("removing_drops_only_that_member", () => {
    const edits = removalOf(TOTALS, "total");

    expect(edits).toEqual([
      { kind: "setField", pointer: POINTER, value: { count: 2 } },
    ]);
  });

  it("adding_names_the_new_value_freely_and_leaves_it_to_fill", () => {
    const first = additionOf(NO_ARGUMENTS);
    const taken = { ...TOTALS, value: { value: "a" } };
    const second = additionOf(taken);

    expect([first, second]).toEqual([
      [
        {
          kind: "setField",
          pointer: NO_ARGUMENTS.pointer,
          value: { value: "" },
        },
      ],
      [
        {
          kind: "setField",
          pointer: POINTER,
          value: { value: "a", "value-2": "" },
        },
      ],
    ]);
  });
});
