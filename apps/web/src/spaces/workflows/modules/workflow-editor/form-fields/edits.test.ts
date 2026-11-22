import { describe, expect, it } from "vitest";
import {
  clearEditsOf,
  dataUseOf,
  jsonCommitOf,
  jsonTextOf,
  numberCommitOf,
  textEditsOf,
  valueEditsOf,
} from "./edits";

const POINTER = "/do/0/fetch/with/endpoint";

const ADDRESS = {
  pointer: POINTER,
  required: true,
  written: true,
  value: "https://example.com",
};

const NOTE = { pointer: POINTER, required: false, written: true, value: "a" };

const UNWRITTEN = { ...NOTE, written: false, value: null };

describe("the edits of a typed text", () => {
  it("a_new_text_sets_the_field", () => {
    const edits = textEditsOf(ADDRESS, "https://example.org");

    expect(edits).toEqual([
      { kind: "setField", pointer: POINTER, value: "https://example.org" },
    ]);
  });

  it("the_same_text_sends_nothing", () => {
    const edits = textEditsOf(ADDRESS, "https://example.com");

    expect(edits).toEqual([]);
  });

  it("an_emptied_required_field_keeps_its_key_with_an_empty_value", () => {
    const edits = textEditsOf(ADDRESS, "");

    expect(edits).toEqual([{ kind: "setField", pointer: POINTER, value: "" }]);
  });

  it("an_emptied_required_field_already_empty_sends_nothing", () => {
    const empty = { ...ADDRESS, value: "" };

    const edits = textEditsOf(empty, "");

    expect(edits).toEqual([]);
  });

  it("an_emptied_optional_field_is_cleared", () => {
    const edits = textEditsOf(NOTE, "");

    expect(edits).toEqual([{ kind: "clearField", pointer: POINTER }]);
  });

  it("an_unwritten_field_left_empty_sends_nothing", () => {
    const edits = clearEditsOf(UNWRITTEN);

    expect(edits).toEqual([]);
  });
});

describe("the edits of a value", () => {
  it("an_unwritten_field_is_written_even_with_its_default", () => {
    const edits = valueEditsOf(UNWRITTEN, null);

    expect(edits).toEqual([
      { kind: "setField", pointer: POINTER, value: null },
    ]);
  });

  it("a_number_is_read_from_its_text", () => {
    const commit = numberCommitOf(UNWRITTEN, " 30 ");

    expect(commit).toEqual({
      kind: "edits",
      edits: [{ kind: "setField", pointer: POINTER, value: 30 }],
    });
  });

  it("a_number_that_is_not_one_is_refused", () => {
    const commit = numberCommitOf(UNWRITTEN, "thirty");

    expect(commit).toEqual({ kind: "refused", reason: "Write a number." });
  });

  it("an_emptied_number_is_cleared", () => {
    const commit = numberCommitOf(NOTE, "");

    expect(commit).toEqual({
      kind: "edits",
      edits: [{ kind: "clearField", pointer: POINTER }],
    });
  });
});

describe("the edits of a value written as JSON", () => {
  it("json_text_is_parsed_into_the_value", () => {
    const commit = jsonCommitOf(UNWRITTEN, '{ "text": "hi" }');

    expect(commit).toEqual({
      kind: "edits",
      edits: [{ kind: "setField", pointer: POINTER, value: { text: "hi" } }],
    });
  });

  it("an_expression_is_kept_as_its_text", () => {
    const commit = jsonCommitOf(UNWRITTEN, "${ .items }");

    expect(commit).toEqual({
      kind: "edits",
      edits: [{ kind: "setField", pointer: POINTER, value: "${ .items }" }],
    });
  });

  it("text_that_is_neither_is_refused_with_how_to_write_it", () => {
    const commit = jsonCommitOf(UNWRITTEN, "{ text: hi }");

    expect(commit).toEqual({
      kind: "refused",
      reason: "Write the value as JSON, or as an expression in ${ }.",
    });
  });

  it("a_required_value_cannot_be_emptied", () => {
    const commit = jsonCommitOf(ADDRESS, "  ");

    expect(commit).toEqual({
      kind: "refused",
      reason: "This field needs a value.",
    });
  });

  it("an_optional_value_emptied_is_cleared", () => {
    const commit = jsonCommitOf(NOTE, "");

    expect(commit).toEqual({
      kind: "edits",
      edits: [{ kind: "clearField", pointer: POINTER }],
    });
  });

  it.each([
    ["nothing", null, ""],
    ["a_text", "${ . }", "${ . }"],
    ["an_object", { a: 1 }, '{\n  "a": 1\n}'],
  ])("%s_is_shown_as_its_text", (_, value, expected) => {
    const text = jsonTextOf(value);

    expect(text).toBe(expected);
  });
});

describe("the edits of data put in a field", () => {
  it("are_one_use_with_the_step_to_export", () => {
    const edits = dataUseOf(POINTER, "${ $context.fetch }", "/do/fetch");

    expect(edits).toEqual([
      {
        kind: "useData",
        pointer: POINTER,
        value: "${ $context.fetch }",
        export: "/do/fetch",
      },
    ]);
  });
});
