import { describe, expect, it } from "vitest";
import {
  FETCH_FORM,
  FETCH_STEP,
  fieldOf,
  POST_FORM,
  POST_STEP,
  REPORT_STEP,
  RETRYING,
  SCRIPT_FORM,
  SCRIPT_STEP,
  SWITCH_FORM,
} from "./forms.test-support";
import { formKindOf, layoutOf, pathOf, summaryOf } from "./layout";

function keysOf(fields: readonly { readonly key: string }[]) {
  return fields.map((field) => field.key);
}

describe("the layout of a step's form", () => {
  it("the_essential_fields_come_first_in_rank_order_from_inside_their_groups", () => {
    const layout = layoutOf(POST_FORM.fields, POST_STEP);

    const essentials = keysOf(layout.essentials);

    expect(essentials).toEqual(["method", "endpoint", "body"]);
  });

  it("more_options_hold_the_other_settings_and_the_rest_of_a_group_that_holds_essentials", () => {
    const layout = layoutOf(FETCH_FORM.fields, FETCH_STEP);

    const more = keysOf(layout.more);

    expect(more).toEqual([
      "headers",
      "body",
      "output",
      "timeout",
      "if",
      "then",
    ]);
  });

  it("a_choice_with_its_only_value_written_is_left_out_as_nothing_to_choose", () => {
    const layout = layoutOf(FETCH_FORM.fields, FETCH_STEP);

    const shown = keysOf(layout.more);

    expect(shown).not.toContain("call");
  });

  it("the_other_unwritten_kinds_of_a_holder_are_left_out_and_named_ones_stay", () => {
    const layout = layoutOf(SCRIPT_FORM.fields, SCRIPT_STEP);

    const more = keysOf(layout.more);

    expect(more).toEqual(["await", "environment", "timeout", "if", "then"]);
  });

  it("data_in_and_out_and_failure_fields_keep_their_own_sections", () => {
    const layout = layoutOf(RETRYING.fields, REPORT_STEP);

    const data = keysOf(layout.data);
    const failure = keysOf(layout.failure);

    expect(data).toEqual(["input", "output"]);
    expect(failure).toEqual([]);
  });
});

describe("the path of a field below its step", () => {
  it("is_the_pointer_after_the_step's_own", () => {
    const endpoint = fieldOf({
      key: "endpoint",
      pointer: `${FETCH_STEP.pointer}/with/endpoint`,
    });

    const path = pathOf(endpoint, FETCH_STEP.pointer);

    expect(path).toBe("with/endpoint");
  });
});

describe("the kind of form a step takes", () => {
  it.each([
    ["an_http_call", "http", "call", FETCH_FORM.fields],
    ["a_script", "script", "run", SCRIPT_FORM.fields],
    ["a_switch", "switch", "switch", SWITCH_FORM.fields],
  ] as const)("%s_takes_the_%s_form", (_, expected, kind, fields) => {
    const formKind = formKindOf(kind, fields);

    expect(formKind).toBe(expected);
  });

  it("a_call_of_a_function_is_a_function_form", () => {
    const fields = FETCH_FORM.fields.map((field) =>
      field.key === "call" ? { ...field, value: "notify" } : field,
    );

    const formKind = formKindOf("call", fields);

    expect(formKind).toBe("function");
  });

  it("a_run_with_no_written_kind_is_a_script_form", () => {
    const fields = SCRIPT_FORM.fields.filter((field) => field.key !== "run");

    const formKind = formKindOf("run", fields);

    expect(formKind).toBe("script");
  });
});

describe("the summary of options behind a disclosure", () => {
  const written = (key: string, title: string) =>
    fieldOf({
      key,
      title,
      pointer: `${FETCH_STEP.pointer}/${key}`,
      written: true,
    });

  it("nothing_written_reads_as_the_usual_settings", () => {
    const summary = summaryOf([], "http", FETCH_STEP.pointer, "Usual settings");

    expect(summary).toBe("Usual settings");
  });

  it("the_written_fields_are_named_in_the_design's_words", () => {
    const fields = [
      written("if", "Run only if"),
      written("timeout", "Timeout"),
    ];

    const summary = summaryOf(fields, "http", FETCH_STEP.pointer, "Usual");

    expect(summary).toBe("Run only if · Time limit");
  });

  it("named_values_are_said_by_how_many_are_set", () => {
    const none = fieldOf({
      key: "headers",
      pointer: `${FETCH_STEP.pointer}/with/headers`,
    });
    const two = { ...none, written: true, value: { a: "1", b: "2" } };

    const empty = summaryOf([none], "http", FETCH_STEP.pointer, "Usual");
    const set = summaryOf([two], "http", FETCH_STEP.pointer, "Usual");

    expect(empty).toBe("No headers");
    expect(set).toBe("Headers: 2");
  });

  it("a_time_limit_is_said_in_seconds", () => {
    const value = { after: { seconds: 45 } };
    const limit = { ...written("timeout", "Timeout"), value };

    const summary = summaryOf(
      [limit],
      "http",
      FETCH_STEP.pointer,
      "Usual",
      45_000,
    );

    expect(summary).toBe("Time limit 45 s");
  });

  it("beyond_three_the_rest_are_counted", () => {
    const fields = ["a", "b", "c", "d", "e"].map((key) => written(key, key));

    const summary = summaryOf(fields, "http", FETCH_STEP.pointer, "Usual");

    expect(summary).toBe("a · b · c · 2 more");
  });
});
