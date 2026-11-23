import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EditAction } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { AFTER_A_TEST } from "../data-picker/data-choices/data.test-support";
import { ConditionBuilder } from "./condition-builder";
import type {
  ConditionBuilderProps,
  PickedData,
  PickerSlot,
} from "./interfaces";
import {
  AN_EXPRESSION,
  BEFORE_TODAY,
  NO_ROWS,
  NON_CANONICAL_TEXT,
  TWO_ROWS_ALL,
  TWO_ROWS_TEXT,
} from "./readings.test-support";

const POINTER = "/do/1/Has items/switch/0/Has items/when";

const SLIDES: PickedData = {
  value: "${ .slideshow.slides }",
  expression: ".slideshow.slides",
  export: null,
};

const GREET: PickedData = {
  value: "${ $context.Greet }",
  expression: "$context.Greet",
  export: "/do/Greet",
};

const IS_NOT_EMPTY = {
  left: ".slideshow.slides",
  comparison: "isNotEmpty",
  right: null,
};

const TITLE_IS = {
  left: ".slideshow.title",
  comparison: "is",
  right: { kind: "value", value: "Sample Slide Show" },
};

function propsOf(
  props: Partial<ConditionBuilderProps>,
  picked: PickedData,
  onEdit: ConditionBuilderProps["onEdit"],
): ConditionBuilderProps {
  return {
    pointer: POINTER,
    text: TWO_ROWS_TEXT,
    required: true,
    labelledBy: "branch",
    describedBy: undefined,
    invalid: false,
    reading: TWO_ROWS_ALL,
    data: AFTER_A_TEST,
    renderPicker: ({ label, onPick }: PickerSlot) => (
      <button
        type="button"
        onClick={() => {
          onPick(picked);
        }}
      >
        {label}
      </button>
    ),
    onEdit,
    ...props,
  };
}

function shown(props: Partial<ConditionBuilderProps> = {}, picked = SLIDES) {
  const onEdit = vi.fn<(actions: readonly EditAction[]) => void>();
  const all = propsOf(props, picked, onEdit);
  const view = render(
    <TooltipProvider>
      <h4 id="branch">Has items</h4>
      <ConditionBuilder {...all} />
    </TooltipProvider>,
  );
  function rerender(next: Partial<ConditionBuilderProps>) {
    const changed = propsOf({ ...props, ...next }, picked, onEdit);
    view.rerender(
      <TooltipProvider>
        <h4 id="branch">Has items</h4>
        <ConditionBuilder {...changed} />
      </TooltipProvider>,
    );
  }
  return { onEdit, rerender };
}

function choose(trigger: HTMLElement, option: string) {
  act(() => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  const item = screen.getByRole("option", { name: option });
  act(() => {
    fireEvent.keyDown(item, { key: "Enter" });
  });
}

function press(name: string, within_: HTMLElement | null = null) {
  const scope = within_ === null ? screen : within(within_);
  const button = scope.getByRole("button", { name });

  act(() => {
    fireEvent.click(button);
  });
}

function row(position: number) {
  return screen.getByRole("group", { name: `Condition ${String(position)}` });
}

function leave(element: HTMLElement, text: string) {
  act(() => {
    fireEvent.focus(element);
    fireEvent.change(element, { target: { value: text } });
    fireEvent.blur(element);
  });
}

describe("a condition in the builder", () => {
  it("shows_each_row_by_the_names_of_its_data_and_the_design's_words", () => {
    shown();

    const first = row(1);
    const second = row(2);

    const hasItems = screen.getByRole("group", { name: "Has items" });
    expect(hasItems).toBeInTheDocument();
    const fetchTheDigest = within(first).getByText(
      "Fetch the digest › slideshow › slides",
    );
    expect(fetchTheDigest).toBeInTheDocument();
    const firstComparison = within(first).getByRole("combobox", {
      name: "Comparison",
    });
    expect(firstComparison).toHaveTextContent("is not empty");
    const valueToCompare = within(second).getByRole("textbox", {
      name: "Value to compare with",
    });
    expect(valueToCompare).toHaveValue("Sample Slide Show");
    const allMustHold = screen.getByRole("radio", { name: "All must hold" });
    expect(allMustHold).toHaveAttribute("aria-checked", "true");
  });

  it("another_comparison_writes_the_condition", () => {
    const { onEdit } = shown();
    const comparison = within(row(2)).getByRole("combobox", {
      name: "Comparison",
    });

    choose(comparison, "is empty");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: {
          join: "all",
          rows: [
            IS_NOT_EMPTY,
            { left: ".slideshow.title", comparison: "isEmpty", right: null },
          ],
        },
      },
    ]);
  });

  it("any_joins_the_rows", () => {
    const { onEdit } = shown();
    const any = screen.getByRole("radio", { name: "Any may hold" });

    act(() => {
      fireEvent.click(any);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: { join: "any", rows: [IS_NOT_EMPTY, TITLE_IS] },
      },
    ]);
  });

  it("a_new_row_waits_until_its_data_is_chosen", () => {
    const { onEdit } = shown();

    press("Add a condition");
    const before = onEdit.mock.calls.length;
    press("Choose data", row(3));

    expect(before).toBe(0);
    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: {
          join: "all",
          rows: [IS_NOT_EMPTY, TITLE_IS, IS_NOT_EMPTY],
        },
      },
    ]);
  });

  it("data_read_through_the_context_exports_its_step_first", () => {
    const { onEdit } = shown({ text: "", reading: NO_ROWS }, GREET);

    press("Choose data", row(1));

    expect(onEdit).toHaveBeenCalledWith([
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

  it("a_number_comparison_refuses_text_and_takes_a_number", () => {
    const { onEdit } = shown();
    const comparison = within(row(2)).getByRole("combobox", {
      name: "Comparison",
    });
    choose(comparison, "is greater than");
    const value = within(row(2)).getByRole("textbox", {
      name: "Value to compare with",
    });

    const refusal = screen.getByRole("alert").textContent;
    leave(value, "3");

    expect(refusal).toBe("Enter a number.");
    expect(onEdit).toHaveBeenLastCalledWith([
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: {
          join: "all",
          rows: [
            IS_NOT_EMPTY,
            {
              left: ".slideshow.title",
              comparison: "isGreaterThan",
              right: { kind: "value", value: 3 },
            },
          ],
        },
      },
    ]);
  });

  it("removing_a_row_writes_the_rest", () => {
    const { onEdit } = shown();

    press("Remove condition 1");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setCondition",
        pointer: POINTER,
        condition: { join: "all", rows: [TITLE_IS] },
      },
    ]);
  });

  it("a_time_or_data_is_compared_by_choice", () => {
    const { onEdit } = shown();
    const kind = within(row(2)).getByRole("combobox", {
      name: "Compared with",
    });

    choose(kind, "Yesterday");
    choose(kind, "Data from the workflow");
    press("Choose data to compare with", row(2));

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "setCondition",
            pointer: POINTER,
            condition: {
              join: "all",
              rows: [
                IS_NOT_EMPTY,
                {
                  left: ".slideshow.title",
                  comparison: "is",
                  right: { kind: "time", time: "yesterday" },
                },
              ],
            },
          },
        ],
      ],
      [
        [
          {
            kind: "setCondition",
            pointer: POINTER,
            condition: {
              join: "all",
              rows: [
                IS_NOT_EMPTY,
                {
                  left: ".slideshow.title",
                  comparison: "is",
                  right: { kind: "data", path: ".slideshow.slides" },
                },
              ],
            },
          },
        ],
      ],
    ]);
  });

  it("times_and_data_on_the_right_are_shown_as_read", () => {
    shown({ text: "", reading: BEFORE_TODAY });

    const first = within(row(1)).getByRole("combobox", {
      name: "Compared with",
    });
    const second = within(row(2)).getByRole("combobox", {
      name: "Compared with",
    });

    expect(first).toHaveTextContent("Today");
    expect(second).toHaveTextContent("Data from the workflow");
    const inputName = within(row(2)).getByText("The workflow's input");
    expect(inputName).toBeInTheDocument();
  });

  it("data_the_picker_does_not_offer_is_shown_as_its_path", () => {
    shown({ data: null });

    const path = within(row(1)).getByText(".slideshow.slides");

    expect(path.tagName).toBe("CODE");
  });

  it("a_reading_from_elsewhere_replaces_the_rows", () => {
    const { rerender } = shown();

    rerender({ text: "", reading: BEFORE_TODAY });

    const due = within(row(1)).getByText(".due");
    expect(due).toBeInTheDocument();
  });

  it("reading_again_keeps_the_rows_on_screen", () => {
    const { rerender } = shown();

    rerender({ reading: null });

    const first = row(1);
    const waiting = screen.queryByText("Reading the condition…");
    expect(first).toBeInTheDocument();
    expect(waiting).toBeNull();
  });

  it("an_expression_it_cannot_show_says_so_to_the_field", () => {
    shown({ text: NON_CANONICAL_TEXT, reading: AN_EXPRESSION });

    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });

    const note = /cannot show this expression/;
    expect(expression).toHaveAccessibleDescription(note);
  });

  it("while_the_condition_is_read_it_says_so", () => {
    shown({ reading: null });

    const readingTheCondition = screen.getByText("Reading the condition…");
    expect(readingTheCondition).toBeInTheDocument();
  });
});

describe("a condition as an expression", () => {
  it("one_the_builder_cannot_show_opens_as_written_and_stays", () => {
    shown({ text: NON_CANONICAL_TEXT, reading: AN_EXPRESSION });

    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });

    expect(expression).toHaveValue(NON_CANONICAL_TEXT);
    const useTheBuilder = screen.queryByRole("button", {
      name: "Use the builder",
    });
    expect(useTheBuilder).toBeNull();
    const cannotShowThis = screen.getByText(/cannot show this expression/);
    expect(cannotShowThis).toBeInTheDocument();
  });

  it("writing_an_expression_keeps_focus_on_the_switch_and_back", () => {
    shown();
    const toggle = screen.getByRole("button", { name: "Write an expression" });
    toggle.focus();

    act(() => {
      fireEvent.click(toggle);
    });
    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });
    const back = screen.getByRole("button", { name: "Use the builder" });

    expect(expression).toHaveValue(TWO_ROWS_TEXT);
    expect(back).toHaveFocus();
  });

  it("a_typed_expression_is_set_at_the_field_as_written", () => {
    const { onEdit } = shown({
      text: NON_CANONICAL_TEXT,
      reading: AN_EXPRESSION,
    });
    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });
    const written = "${ .ok and\n  .ready }";

    leave(expression, written);

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: POINTER, value: written },
    ]);
  });

  it("an_expression_left_as_written_sends_nothing", () => {
    const { onEdit } = shown({
      text: NON_CANONICAL_TEXT,
      reading: AN_EXPRESSION,
    });
    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });

    leave(expression, NON_CANONICAL_TEXT);

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("an_optional_condition_emptied_is_cleared", () => {
    const { onEdit } = shown({
      text: NON_CANONICAL_TEXT,
      reading: AN_EXPRESSION,
      required: false,
    });
    const expression = screen.getByRole("textbox", {
      name: "Condition as an expression",
    });

    leave(expression, "");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "clearField", pointer: POINTER },
    ]);
  });

  it("an_expression_that_reads_as_rows_can_go_back_to_the_builder", () => {
    const { rerender } = shown({
      text: NON_CANONICAL_TEXT,
      reading: AN_EXPRESSION,
    });

    rerender({ text: TWO_ROWS_TEXT, reading: TWO_ROWS_ALL });
    press("Use the builder");

    const secondRow = row(2);
    expect(secondRow).toBeInTheDocument();
  });
});

describe("changes that change nothing", () => {
  it("pressing_the_join_in_force_or_leaving_a_value_as_it_was_sends_nothing", () => {
    const { onEdit } = shown();
    const all = screen.getByRole("radio", { name: "All must hold" });
    const value = within(row(2)).getByRole("textbox", {
      name: "Value to compare with",
    });

    act(() => {
      fireEvent.click(all);
    });
    leave(value, "Sample Slide Show");

    expect(onEdit).not.toHaveBeenCalled();
  });
});
