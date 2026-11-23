import { fireEvent, render, screen } from "@testing-library/react";
import type { EditAction, FormField } from "language-server/protocol";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DiagnosticSeverity } from "vscode-languageserver-protocol";
import { FieldControl } from "./field-control";

function fieldOf(
  key: string,
  pointer: string,
  input: FormField["input"],
  value: FormField["value"],
  fields: readonly FormField[] = [],
): FormField {
  return {
    key,
    title: key,
    pointer,
    section: "settings",
    description: null,
    input,
    choices: [],
    required: false,
    written: value !== null,
    value,
    suggested: false,
    essentialRank: null,
    fields,
    diagnostics: [],
  };
}

const every = fieldOf("every", "/schedule/every", "duration", "PT15M", [
  fieldOf("hours", "/schedule/every/hours", "number", null),
  fieldOf("minutes", "/schedule/every/minutes", "number", 15),
]);

const on = fieldOf("on", "/schedule/on", "group", null, [
  fieldOf("one", "/schedule/on/one", "structured", null),
]);

const schedule = fieldOf(
  "schedule",
  "/schedule",
  "oneOf",
  { every: { minutes: 15 } },
  [every, fieldOf("cron", "/schedule/cron", "text", null), on],
);

function show(field: FormField = schedule) {
  const onEdit = vi.fn<(action: EditAction) => void>();
  render(<FieldControl field={field} onEdit={onEdit} />);
  return onEdit;
}

function pick(option: string) {
  const trigger = screen.getByRole("combobox", { name: "schedule" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function commit(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("a choice among alternatives", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => undefined;
  });

  it("another_alternative_replaces_the_choice_whole", () => {
    const onEdit = show();

    pick("cron");
    commit(screen.getByRole("textbox", { name: "cron" }), "0 9 * * *");

    expect(onEdit).toHaveBeenCalledWith({
      kind: "setField",
      pointer: "/schedule",
      value: { cron: "0 9 * * *" },
    });
  });

  it("a_member_of_an_alternative_not_written_nests_under_it", () => {
    const onEdit = show();

    pick("on");
    commit(screen.getByRole("textbox", { name: "one" }), '{ "with": {} }');

    expect(onEdit).toHaveBeenCalledWith({
      kind: "setField",
      pointer: "/schedule",
      value: { on: { one: { with: {} } } },
    });
  });

  it("the_written_duration_is_set_whole_and_emptying_it_clears_the_choice", () => {
    const onEdit = show();
    const amount = screen.getByRole("spinbutton", { name: "every" });

    commit(amount, "20");
    commit(amount, "");

    expect(onEdit).toHaveBeenNthCalledWith(1, {
      kind: "setField",
      pointer: "/schedule/every",
      value: { minutes: 20 },
    });
    expect(onEdit).toHaveBeenNthCalledWith(2, {
      kind: "clearField",
      pointer: "/schedule",
    });
  });

  it("arrow_keys_move_through_the_choices_without_clearing_and_not_set_clears", () => {
    const onEdit = show();
    const trigger = screen.getByRole("combobox", { name: "schedule" });

    fireEvent.keyDown(trigger, { key: "Enter" });
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowUp" });
    fireEvent.keyDown(listbox, { key: "ArrowUp" });
    const moved = onEdit.mock.calls.length;
    fireEvent.click(screen.getByRole("option", { name: "Not set" }));

    expect(moved).toBe(0);
    expect(onEdit).toHaveBeenCalledWith({
      kind: "clearField",
      pointer: "/schedule",
    });
  });

  it("a_problem_with_the_choice_itself_shows_beside_it", () => {
    const at = { line: 7, character: 0 };
    const diagnostic = {
      range: { start: at, end: at },
      severity: DiagnosticSeverity.Error,
      message: "The schedule takes one trigger.",
    };
    show({ ...schedule, diagnostics: [diagnostic] });

    expect(screen.getByText("The schedule takes one trigger.")).toBeVisible();
  });
});

describe("a value field", () => {
  it("a_changed_value_is_written_and_an_emptied_one_cleared", () => {
    const condition = fieldOf("if", "/do/0/fetch/if", "text", "${ .ready }");
    const onEdit = show(condition);
    const input = screen.getByLabelText("if");

    commit(input, "${ .go }");
    commit(input, "");

    expect(onEdit).toHaveBeenNthCalledWith(1, {
      kind: "setField",
      pointer: "/do/0/fetch/if",
      value: "${ .go }",
    });
    expect(onEdit).toHaveBeenNthCalledWith(2, {
      kind: "clearField",
      pointer: "/do/0/fetch/if",
    });
  });

  it("a_structured_value_that_does_not_read_is_refused_here", () => {
    const output = fieldOf("output", "/do/0/fetch/output", "structured", null);
    const onEdit = show(output);
    const input = screen.getByLabelText("output");

    commit(input, "{ as: ");

    expect(onEdit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
