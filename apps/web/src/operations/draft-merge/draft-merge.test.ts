import { describe, expect, it } from "vitest";
import { mergedDrafts } from "./draft-merge";

const BASE = "document:\n  name: leads\ndo:\n  - fetch:\n      call: http\n";

describe("merging two drafts that grew from one", () => {
  it("changes_on_different_lines_keep_both", () => {
    const mine = BASE.replace("name: leads", "name: lead-intake");
    const theirs = BASE.replace("call: http", "call: grpc");

    const merged = mergedDrafts(BASE, mine, theirs);

    expect(merged).toEqual({
      kind: "clean",
      text: "document:\n  name: lead-intake\ndo:\n  - fetch:\n      call: grpc\n",
    });
  });

  it("the_same_change_on_both_sides_is_no_conflict", () => {
    const both = BASE.replace("call: http", "call: grpc");

    const merged = mergedDrafts(BASE, both, both);

    expect(merged).toEqual({ kind: "clean", text: both });
  });

  it("different_changes_to_one_line_conflict", () => {
    const mine = BASE.replace("call: http", "call: grpc");
    const theirs = BASE.replace("call: http", "call: openapi");

    const merged = mergedDrafts(BASE, mine, theirs);

    expect(merged).toEqual({ kind: "conflicting" });
  });
});
