import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type {
  EditAction,
  FormField,
  StepFormResult,
} from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  FETCH_FORM,
  FETCH_STEP,
  fieldOf,
  formChanged,
  formWith,
  protectionOf,
  REPORT_FORM,
  REPORT_INNER_STEP,
  RETRYING,
  SCRIPT_FORM,
  SCRIPT_STEP,
  SET_STEP,
  setFormOf,
  stepOf,
  SWITCH_FORM,
  SWITCH_STEP,
  WAIT_FORM,
  WAIT_STEP,
} from "../form-fields/forms.test-support";
import type { DataSlot, StepFormProps } from "./interfaces";
import { StepForm } from "./step-form";

const RAISE = stepOf("Refuse", 0, "raise");

const AT = `${RAISE.pointer}/raise/error`;

function essential(rank: number, shape: Partial<FormField> & { key: string }) {
  return fieldOf({
    pointer: `${AT}/${shape.key}`,
    essentialRank: rank,
    ...shape,
  });
}

const RAISE_FORM: StepFormResult = {
  version: 1,
  step: RAISE.id,
  failure: "stop",
  result: null,
  fields: [
    fieldOf({
      key: "then",
      pointer: `${RAISE.pointer}/then`,
      choices: ["continue", "end", "Totals"],
      written: true,
      value: "end",
    }),
    essential(0, {
      key: "title",
      required: true,
      written: true,
      value: "No email",
      choices: ["No email", "No name"],
    }),
    essential(1, { key: "status", input: "number", written: true, value: 400 }),
    essential(2, {
      key: "type",
      input: "choice",
      choices: ["validation", "runtime"],
      written: true,
      value: "validation",
    }),
    essential(3, { key: "public", input: "boolean" }),
    essential(4, { key: "details", input: "structured" }),
  ],
};

function formWithMethod(method: string): StepFormResult {
  const fields = FETCH_FORM.fields.map((field) => {
    if (field.key !== "with") return field;

    const inner = field.fields.map((each) =>
      each.key === "method" ? { ...each, value: method } : each,
    );
    return { ...field, fields: inner };
  });
  return { ...FETCH_FORM, fields };
}

function shown(props: Partial<StepFormProps> = {}) {
  const onEdit = vi.fn<(actions: readonly EditAction[]) => void>();
  const all: StepFormProps = {
    step: RAISE,
    form: RAISE_FORM,
    protection: null,
    revealProblems: false,
    languageTerms: false,
    onEdit,
    ...props,
  };
  render(
    <TooltipProvider>
      <StepForm {...all} />
    </TooltipProvider>,
  );
  return { onEdit };
}

function leave(element: HTMLElement, text: string) {
  act(() => {
    fireEvent.focus(element);
    fireEvent.change(element, { target: { value: text } });
    fireEvent.blur(element);
  });
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

function open(title: string) {
  const header = screen.getByRole("button", { name: title });

  act(() => {
    fireEvent.click(header);
  });
}

describe("a field the client marks to fill", () => {
  it("an_empty_error_title_says_fill_in_and_after_leaving_how_to_fill_it", () => {
    const untitled: StepFormResult = {
      ...RAISE_FORM,
      fields: [
        essential(0, {
          key: "title",
          required: true,
          written: true,
          value: "",
        }),
      ],
    };
    shown({ form: untitled });
    const title = screen.getByRole("textbox", { name: "Error title" });
    const before = screen.getByText("Fill in");
    expect(before).toBeInTheDocument();

    leave(title, "");

    const error = screen.getByRole("alert");
    const fill = screen.queryByText("Fill in");
    expect(error).toHaveTextContent("Give the error a title.");
    expect(fill).toBeNull();
  });

  it("empty_script_code_says_fill_in_and_is_not_optional", () => {
    const pointer = `${SCRIPT_STEP.pointer}/run/script/code`;
    const blank = formChanged(SCRIPT_FORM, pointer, { value: "" });
    shown({ step: SCRIPT_STEP, form: blank });

    const field = screen.getByRole("textbox", { name: "Code" });
    const description = "Print the result as JSON. Fill in";

    expect(field).toHaveAccessibleDescription(description);
    expect(field).toHaveAccessibleName("Code");
  });
});

describe("a field's value by its kind", () => {
  it("a_text_offers_the_language_server's_suggestions", () => {
    shown();

    const title = screen.getByRole("combobox", { name: "Error title" });
    const options = document.querySelectorAll("datalist option");

    expect(title).toHaveValue("No email");
    expect(options).toHaveLength(2);
  });

  it("a_number_is_set_from_its_text", () => {
    const { onEdit } = shown();
    const status = screen.getByRole("textbox", { name: /status/ });

    leave(status, "422");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: `${AT}/status`, value: 422 },
    ]);
  });

  it("a_number_that_is_not_one_is_refused_beside_it", () => {
    const { onEdit } = shown();
    const status = screen.getByRole("textbox", { name: /status/ });

    leave(status, "four");

    expect(screen.getByRole("alert")).toHaveTextContent("Write a number.");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("a_choice_can_go_back_to_the_usual_value", () => {
    const { onEdit } = shown();
    const type = screen.getByRole("combobox", { name: /Kind of error/ });

    choose(type, "Usual");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "clearField", pointer: `${AT}/type` },
    ]);
  });

  it("a_choice_sets_its_value", () => {
    const { onEdit } = shown();
    const type = screen.getByRole("combobox", { name: /Kind of error/ });

    choose(type, "runtime");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: `${AT}/type`, value: "runtime" },
    ]);
  });

  it("a_yes_or_no_is_a_switch", () => {
    const { onEdit } = shown();
    const flag = screen.getByRole("switch", { name: /public/ });

    act(() => {
      fireEvent.click(flag);
    });

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: `${AT}/public`, value: true },
    ]);
  });

  it("a_structured_value_is_json_and_wrong_json_is_refused", () => {
    const { onEdit } = shown();
    const details = screen.getByRole("textbox", { name: /details/ });

    leave(details, "{ nope");
    const refusal = screen.getByRole("alert").textContent;
    leave(details, '{ "field": "email" }');

    expect(refusal).toBe(
      "Write the value as JSON, or as an expression in ${ }.",
    );
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: `${AT}/details`, value: { field: "email" } },
    ]);
  });
});

describe("where the step goes next", () => {
  it("going_to_a_step_is_written_and_continuing_clears_it", () => {
    const { onEdit } = shown();
    open("More options");
    const after = screen.getByRole("combobox", { name: /After this step/ });

    choose(after, "Go to “Totals”");
    choose(after, "Continue with the next step");

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "setField",
            pointer: `${RAISE.pointer}/then`,
            value: "Totals",
          },
        ],
      ],
      [[{ kind: "clearField", pointer: `${RAISE.pointer}/then` }]],
    ]);
  });
});

describe("branch actions", () => {
  const routed = formWith(SWITCH_FORM, "switch", [
    { first: { when: "${ .a }" } },
    { second: { when: "${ .b }" } },
  ]);

  function actOn(branch: string, item: string) {
    const trigger = screen.getByRole("button", {
      name: `Branch actions for ${branch}`,
    });
    act(() => {
      fireEvent.keyDown(trigger, { key: "Enter" });
    });
    const menuItem = screen.getByRole("menuitem", { name: item });
    act(() => {
      fireEvent.click(menuItem);
    });
  }

  it("a_branch_moves_down_past_its_neighbour", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: routed });

    actOn("first", "Move down");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch`,
        value: [
          { second: { when: "${ .b }" } },
          { first: { when: "${ .a }" } },
        ],
      },
    ]);
  });

  it("a_branch_moves_up_or_is_removed", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: routed });

    actOn("second", "Move up");
    actOn("second", "Remove branch");

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "setField",
            pointer: `${SWITCH_STEP.pointer}/switch`,
            value: [
              { second: { when: "${ .b }" } },
              { first: { when: "${ .a }" } },
            ],
          },
        ],
      ],
      [
        [
          {
            kind: "setField",
            pointer: `${SWITCH_STEP.pointer}/switch`,
            value: [{ first: { when: "${ .a }" } }],
          },
        ],
      ],
    ]);
  });

  it("with_no_otherwise_choosing_to_end_writes_one", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: routed });
    const otherwise = screen.getByRole("group", { name: "Otherwise" });
    const then = within(otherwise).getByRole("combobox", { name: "Then" });

    choose(then, "End the run");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch`,
        value: [
          { first: { when: "${ .a }" } },
          { second: { when: "${ .b }" } },
          { default: { then: "end" } },
        ],
      },
    ]);
  });

  it("a_branch_goes_elsewhere_by_its_then", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: routed });
    const first = screen.getByRole("group", { name: "first" });
    const then = within(first).getByRole("combobox", { name: "Then" });

    choose(then, "End the run");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch/0/first/then`,
        value: "end",
      },
    ]);
  });

  it("branches_written_as_an_expression_stay_json", () => {
    const written = formWith(SWITCH_FORM, "switch", "${ .routes }");
    shown({ step: SWITCH_STEP, form: written });

    const branches = screen.getByRole("textbox", { name: /Branches/ });

    expect(branches).toHaveValue("${ .routes }");
  });

  it("a_condition_slot_gets_each_branch's_when", () => {
    const renderCondition = vi.fn(() => <p>A builder</p>);
    shown({ step: SWITCH_STEP, form: routed, renderCondition });

    expect(renderCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        pointer: `${SWITCH_STEP.pointer}/switch/1/second/when`,
        text: "${ .b }",
      }),
    );
  });
});

describe("named values", () => {
  it("a_value_that_is_not_text_is_written_as_json", () => {
    const counted = setFormOf({ total: "1" }, "inputAndValues");
    const numbered = formWith(counted, "set", { count: 2 });
    const { onEdit } = shown({ step: SET_STEP, form: numbered });
    const value = screen.getByRole("textbox", { name: "Value of count" });

    leave(value, "3");
    leave(value, "{ nope");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer: `${SET_STEP.pointer}/set/count`, value: 3 },
    ]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Write the value as JSON",
    );
  });

  it("a_value_in_the_data_slot_reports_uses_and_clearing", () => {
    const renderData = (slot: DataSlot) => (
      <>
        <button
          type="button"
          onClick={() => {
            slot.onUse({ value: "${ .x }", export: null });
          }}
        >
          Use
        </button>
        <button type="button" onClick={slot.onClear}>
          Clear
        </button>
      </>
    );
    const { onEdit } = shown({
      step: SET_STEP,
      form: setFormOf({ total: "1" }, "inputAndValues"),
      renderData,
    });

    act(() => {
      screen.getByRole("button", { name: "Use" }).click();
      screen.getByRole("button", { name: "Clear" }).click();
    });

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "useData",
            pointer: `${SET_STEP.pointer}/set/total`,
            value: "${ .x }",
            export: null,
          },
        ],
      ],
      [
        [
          {
            kind: "setField",
            pointer: `${SET_STEP.pointer}/set/total`,
            value: "",
          },
        ],
      ],
    ]);
  });

  it("values_written_as_an_expression_stay_one_field", () => {
    const empty = setFormOf({}, "inputAndValues");
    const computed = formWith(empty, "set", "${ .all }");
    shown({ step: SET_STEP, form: computed });

    const values = screen.getByRole("textbox", { name: /Values/ });

    expect(values).toHaveValue("${ .all }");
  });
});

describe("segmented choices", () => {
  it("pressing_the_chosen_item_again_sends_nothing", () => {
    const { onEdit } = shown({ step: FETCH_STEP, form: FETCH_FORM });
    const get = screen.getByRole("radio", { name: "Get data" });

    act(() => {
      fireEvent.click(get);
    });

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("a_method_of_another_kind_leaves_both_usual_ones_unpressed", () => {
    const put = formWithMethod("put");
    shown({ step: FETCH_STEP, form: put });

    const get = screen.getByRole("radio", { name: "Get data" });
    const send = screen.getByRole("radio", { name: "Send data" });

    expect(get).toHaveAttribute("aria-checked", "false");
    expect(send).toHaveAttribute("aria-checked", "false");
  });
});

describe("a script's result written another way", () => {
  it("is_said_to_be_as_written_and_the_same_choice_sends_nothing", () => {
    const written = {
      ...SCRIPT_FORM,
      result: {
        value: "written" as const,
        choices: SCRIPT_FORM.result?.choices ?? [],
      },
    };
    shown({ step: SCRIPT_STEP, form: written });

    const result = screen.getByRole("combobox", { name: "The step's result" });

    expect(result).toHaveTextContent("As written in the text");
  });

  it("choosing_the_result_in_force_sends_nothing", () => {
    const { onEdit } = shown({ step: SCRIPT_STEP, form: SCRIPT_FORM });
    const result = screen.getByRole("combobox", { name: "The step's result" });

    choose(result, "The JSON it prints (usual)");

    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("a duration's amount and unit", () => {
  it("another_unit_writes_the_amount_in_it", () => {
    const { onEdit } = shown({ step: WAIT_STEP, form: WAIT_FORM });
    const unit = screen.getByRole("combobox", { name: /Wait for.*unit/ });

    choose(unit, "hours");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${WAIT_STEP.pointer}/wait`,
        value: { hours: 30 },
      },
    ]);
  });

  it("leaving_the_amount_as_shown_sends_nothing", () => {
    const { onEdit } = shown({ step: WAIT_STEP, form: WAIT_FORM });
    const amount = screen.getByRole("textbox", { name: /Wait for/ });

    leave(amount, "30");

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("an_amount_that_is_no_number_is_refused_and_an_empty_one_clears", () => {
    const { onEdit } = shown({ step: WAIT_STEP, form: WAIT_FORM });
    const amount = screen.getByRole("textbox", { name: /Wait for/ });

    leave(amount, "soon");
    const refusal = screen.getByRole("alert").textContent;
    leave(amount, "");

    expect(refusal).toBe("Write the amount as a number.");
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "clearField", pointer: `${WAIT_STEP.pointer}/wait` },
    ]);
  });
});

describe("retry settings", () => {
  it("an_amount_that_is_not_one_or_unchanged_sends_nothing", () => {
    const { onEdit } = shown({
      step: REPORT_INNER_STEP,
      form: REPORT_FORM,
      protection: RETRYING,
    });
    open("If this step fails");
    const seconds = screen.getByRole("textbox", {
      name: "Seconds between tries",
    });

    leave(seconds, "later");
    leave(seconds, "2");

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("a_retry_written_in_another_form_says_so", () => {
    const linear = protectionOf(
      { retry: { delay: "PT2S", limit: { attempt: { count: 3 } } } },
      "retry",
    );
    shown({ step: REPORT_INNER_STEP, form: REPORT_FORM, protection: linear });
    open("If this step fails");

    const note = screen.getByText(/written in another form/);

    expect(note).toBeInTheDocument();
  });
});
