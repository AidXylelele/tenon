import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EditAction } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  FETCH_FORM,
  FETCH_STEP,
  HANDLING,
  POST_FORM,
  POST_STEP,
  REPORT_FORM,
  REPORT_INNER_STEP,
  REPORT_STEP,
  RETRYING,
  SCRIPT_FORM,
  SCRIPT_STEP,
  SET_FORM,
  SET_STEP,
  setFormOf,
  SWITCH_FORM,
  SWITCH_STEP,
  WAIT_FORM,
  WAIT_STEP,
} from "../form-fields/forms.test-support";
import type { StepFormProps } from "./interfaces";

const SWITCH_CASES_FIRST = {
  "Has items": {
    when: '${ .slideshow.slides | . != null and . != "" and . != [] and . != {} }',
    then: "continue",
  },
};
import { StepForm } from "./step-form";

type Shown = Partial<StepFormProps>;

function shown(props: Shown = {}) {
  const onEdit = vi.fn<(actions: readonly EditAction[]) => void>();
  const all: StepFormProps = {
    step: FETCH_STEP,
    form: FETCH_FORM,
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

function open(summary: string) {
  const toggle = screen.getByText(summary);
  const details = toggle.closest("details");

  act(() => {
    details?.setAttribute("open", "");
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

describe("a step's essential fields", () => {
  it("come_first_in_the_design's_words_with_the_rest_behind_more_options", () => {
    shown();

    const method = screen.getByRole("radio", { name: "Get data" });
    const address = screen.getByLabelText("Address");
    const headers = screen.getByLabelText(/Headers/);

    expect(method).toHaveAttribute("aria-checked", "true");
    expect(address).toHaveValue("https://httpbin.org/json");
    expect(headers).not.toBeVisible();
  });

  it("an_address_to_fill_says_fill_in_and_no_error_yet", () => {
    shown({ step: POST_STEP, form: POST_FORM });
    const address = screen.getByLabelText("Address");

    const fill = screen.getByText("Fill in");

    expect(fill).toBeInTheDocument();
    expect(address).toHaveAccessibleDescription("Fill in");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an_address_left_empty_says_how_to_fill_it", () => {
    shown({ step: POST_STEP, form: POST_FORM });
    const address = screen.getByLabelText("Address");

    leave(address, "");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the address to call, for example https://api.example.com/orders",
    );
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Fill in")).toBeNull();
  });

  it("test_or_publish_shows_every_problem_at_once", () => {
    shown({ step: POST_STEP, form: POST_FORM, revealProblems: true });

    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Enter the address to call");
    expect(screen.queryByText("Fill in")).toBeNull();
  });

  it("a_typed_address_is_set_when_the_field_is_left", () => {
    const { onEdit } = shown({ step: POST_STEP, form: POST_FORM });
    const address = screen.getByLabelText("Address");

    leave(address, "https://hooks.example.com/digest");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${POST_STEP.pointer}/with/endpoint`,
        value: "https://hooks.example.com/digest",
      },
    ]);
  });

  it("sending_data_changes_the_method", () => {
    const { onEdit } = shown();
    const send = screen.getByRole("radio", { name: "Send data" });

    act(() => {
      fireEvent.click(send);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${FETCH_STEP.pointer}/with/method`,
        value: "post",
      },
    ]);
  });

  it("another_method_is_offered_under_more_options", () => {
    const { onEdit } = shown();
    open("More options");
    const put = screen.getByRole("radio", { name: "PUT" });

    act(() => {
      fireEvent.click(put);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${FETCH_STEP.pointer}/with/method`,
        value: "put",
      },
    ]);
  });

  it("language_terms_show_each_field's_place_in_the_text", () => {
    shown({ languageTerms: true });

    const term = screen.getByText("with.endpoint");

    expect(term.tagName).toBe("CODE");
  });
});

describe("the step's name", () => {
  it("a_new_name_renames_the_step", () => {
    const { onEdit } = shown();
    const name = screen.getByLabelText("Name");

    leave(name, " Fetch the news ");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "renameStep", step: FETCH_STEP.id, name: "Fetch the news" },
    ]);
  });

  it("an_empty_name_is_refused_and_nothing_is_sent", () => {
    const { onEdit } = shown();
    const name = screen.getByLabelText("Name");

    leave(name, "  ");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give the step a name.",
    );
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("the_same_name_sends_nothing", () => {
    const { onEdit } = shown();
    const name = screen.getByLabelText("Name");

    leave(name, "Fetch the digest");

    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("the slots other features fill", () => {
  it("a_field_that_takes_data_hands_the_data_slot_its_place_and_reports_a_use", () => {
    const renderData = vi.fn(
      (slot: Parameters<NonNullable<StepFormProps["renderData"]>>[0]) => (
        <button
          type="button"
          onClick={() => {
            slot.onUse({ value: "${ $context.fetch }", export: "/do/fetch" });
          }}
        >
          {`Insert data into ${slot.pointer}`}
        </button>
      ),
    );
    const { onEdit } = shown({ step: POST_STEP, form: POST_FORM, renderData });
    const insert = screen.getByRole("button", {
      name: `Insert data into ${POST_STEP.pointer}/with/endpoint`,
    });

    act(() => {
      fireEvent.click(insert);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "useData",
        pointer: `${POST_STEP.pointer}/with/endpoint`,
        value: "${ $context.fetch }",
        export: "/do/fetch",
      },
    ]);
  });

  it("the_data_slot's_text_and_clearing_become_field_edits", () => {
    const renderData = (
      slot: Parameters<NonNullable<StepFormProps["renderData"]>>[0],
    ) => (
      <>
        <button
          type="button"
          onClick={() => {
            slot.onText("https://a.example");
          }}
        >
          Type
        </button>
        <button type="button" onClick={slot.onClear}>
          Clear
        </button>
      </>
    );
    const { onEdit } = shown({ renderData });
    const [type] = screen.getAllByRole("button", { name: "Type" });
    const [clear] = screen.getAllByRole("button", { name: "Clear" });

    act(() => {
      type?.click();
      clear?.click();
    });

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "setField",
            pointer: `${FETCH_STEP.pointer}/with/endpoint`,
            value: "https://a.example",
          },
        ],
      ],
      [
        [
          {
            kind: "setField",
            pointer: `${FETCH_STEP.pointer}/with/endpoint`,
            value: "",
          },
        ],
      ],
    ]);
  });

  it("a_condition_is_added_by_its_slot_at_run_only_if", () => {
    const renderCondition = vi.fn(() => <p>The builder</p>);
    shown({ renderCondition });
    open("More options");
    const add = screen.getByRole("button", { name: "Add a condition" });

    act(() => {
      fireEvent.click(add);
    });

    expect(screen.getByText("The builder")).toBeInTheDocument();
    expect(renderCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        pointer: `${FETCH_STEP.pointer}/if`,
        text: "",
      }),
    );
  });

  it("the_code_of_a_script_goes_to_the_code_slot_with_its_language", () => {
    const renderCode = vi.fn(() => <p>The code editor</p>);
    shown({ step: SCRIPT_STEP, form: SCRIPT_FORM, renderCode });

    expect(screen.getByText("The code editor")).toBeInTheDocument();
    expect(renderCode).toHaveBeenCalledWith(
      expect.objectContaining({ language: "js" }),
    );
  });

  it("without_a_code_slot_the_code_is_plain_text", () => {
    shown({ step: SCRIPT_STEP, form: SCRIPT_FORM });

    const code = screen.getByRole("textbox", { name: /Code/ });

    expect(code).toHaveValue("console.log(JSON.stringify({ people: [] }))\n");
  });
});

describe("a switch's branches", () => {
  it("each_branch_has_its_condition_and_where_it_goes_and_otherwise_ends", () => {
    shown({ step: SWITCH_STEP, form: SWITCH_FORM });

    const branch = screen.getByRole("group", { name: "Has items" });
    const otherwise = screen.getByRole("group", { name: "Otherwise" });

    expect(
      within(branch).getByRole("textbox", { name: "Condition of Has items" }),
    ).toBeInTheDocument();
    expect(
      within(otherwise).getByRole("combobox", { name: "Then" }),
    ).toHaveTextContent("End the run");
  });

  it("a_branch_is_added_before_otherwise", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: SWITCH_FORM });
    const add = screen.getByRole("button", { name: "Add a branch" });

    act(() => {
      fireEvent.click(add);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch`,
        value: [
          SWITCH_CASES_FIRST,
          { "branch-1": { when: "", then: "continue" } },
          { default: { then: "end" } },
        ],
      },
    ]);
  });

  it("a_condition_written_as_an_expression_is_set_at_its_when", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: SWITCH_FORM });
    const condition = screen.getByRole("textbox", {
      name: "Condition of Has items",
    });

    leave(condition, "${ .ok }");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch/0/Has items/when`,
        value: "${ .ok }",
      },
    ]);
  });

  it("otherwise_can_go_on_to_the_next_step", () => {
    const { onEdit } = shown({ step: SWITCH_STEP, form: SWITCH_FORM });
    const otherwise = screen.getByRole("group", { name: "Otherwise" });
    const then = within(otherwise).getByRole("combobox", { name: "Then" });

    choose(then, "Continue with the next step");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SWITCH_STEP.pointer}/switch/1/default/then`,
        value: "continue",
      },
    ]);
  });
});

describe("set data", () => {
  it("keeps_the_incoming_data_until_turned_off", () => {
    const { onEdit } = shown({ step: SET_STEP, form: SET_FORM });
    const keep = screen.getByRole("switch", {
      name: "Keep the data that came in",
    });

    act(() => {
      fireEvent.click(keep);
    });

    expect(keep).toHaveAttribute("aria-checked", "true");
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setResult", step: SET_STEP.id, result: "valuesOnly" },
    ]);
  });

  it("a_result_written_another_way_says_so_and_can_be_turned_on", () => {
    const written = setFormOf({ total: "1" }, "written");
    const { onEdit } = shown({ step: SET_STEP, form: written });
    const keep = screen.getByRole("switch", {
      name: "Keep the data that came in",
    });

    act(() => {
      fireEvent.click(keep);
    });

    expect(screen.getByText(/written as an expression/)).toBeInTheDocument();
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setResult", step: SET_STEP.id, result: "inputAndValues" },
    ]);
  });

  it("each_value_is_a_named_row_and_a_new_one_can_be_added", () => {
    const { onEdit } = shown({ step: SET_STEP, form: SET_FORM });
    const name = screen.getByRole("textbox", { name: "Name of value 1" });
    const add = screen.getByRole("button", { name: "Add a value" });

    act(() => {
      fireEvent.click(add);
    });

    expect(name).toHaveValue("total");
    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${SET_STEP.pointer}/set`,
        value: { total: "${ [.slideshow.slides[]] | length }", value: "" },
      },
    ]);
  });

  it("a_value_renamed_to_a_taken_name_is_refused", () => {
    const two = setFormOf({ total: "1", count: "2" }, "inputAndValues");
    const { onEdit } = shown({ step: SET_STEP, form: two });
    const name = screen.getByRole("textbox", { name: "Name of value 1" });

    leave(name, "count");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Another value is already named “count”.",
    );
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("a_value_is_typed_or_removed", () => {
    const { onEdit } = shown({ step: SET_STEP, form: SET_FORM });
    const value = screen.getByRole("textbox", { name: "Value of total" });
    const remove = screen.getByRole("button", { name: "Remove total" });

    leave(value, "${ 2 }");
    act(() => {
      fireEvent.click(remove);
    });

    expect(onEdit.mock.calls).toEqual([
      [
        [
          {
            kind: "setField",
            pointer: `${SET_STEP.pointer}/set/total`,
            value: "${ 2 }",
          },
        ],
      ],
      [[{ kind: "setField", pointer: `${SET_STEP.pointer}/set`, value: {} }]],
    ]);
  });
});

describe("a script's result", () => {
  it("is_chosen_in_words", () => {
    const { onEdit } = shown({ step: SCRIPT_STEP, form: SCRIPT_FORM });
    const result = screen.getByRole("combobox", { name: "The step's result" });

    choose(result, "Its exit code");

    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setResult", step: SCRIPT_STEP.id, result: "exitCode" },
    ]);
  });
});

describe("if this step fails", () => {
  it("closed_it_says_what_happens", () => {
    shown({ step: REPORT_INNER_STEP, form: REPORT_FORM, protection: RETRYING });

    const summary = screen.getByText("Retry 3×, 2 s apart, growing; then stop");

    expect(summary).toBeVisible();
  });

  it("a_choice_is_set_on_the_try_that_protects_the_step", () => {
    const { onEdit } = shown({
      step: REPORT_INNER_STEP,
      form: REPORT_FORM,
      protection: RETRYING,
    });
    open("If this step fails");
    const next = screen.getByRole("radio", {
      name: "Continue with the next step",
    });

    act(() => {
      fireEvent.click(next);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "continue" },
      },
    ]);
  });

  it("retry_settings_change_the_retry", () => {
    const { onEdit } = shown({
      step: REPORT_INNER_STEP,
      form: REPORT_FORM,
      protection: RETRYING,
    });
    open("If this step fails");
    const times = screen.getByLabelText("Try again");

    leave(times, "5");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "retry", retries: 5, seconds: 2, growing: true },
      },
    ]);
  });

  it("a_steady_wait_is_chosen_in_words", () => {
    const { onEdit } = shown({
      step: REPORT_INNER_STEP,
      form: REPORT_FORM,
      protection: RETRYING,
    });
    open("If this step fails");
    const wait = screen.getByRole("combobox", {
      name: "The wait between tries",
    });

    choose(wait, "stays the same");

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "retry", retries: 3, seconds: 2, growing: false },
      },
    ]);
  });

  it("a_retry_that_cannot_be_read_says_so", () => {
    shown({ step: REPORT_INNER_STEP, form: REPORT_FORM, protection: HANDLING });
    open("If this step fails");
    const retryThenHandle = screen.getByRole("radio", {
      name: "Retry, then run other steps",
    });

    expect(retryThenHandle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/press the lane's \+/)).toBeInTheDocument();
  });

  it("a_step_without_a_try_wraps_itself_to_retry", () => {
    const { onEdit } = shown({ step: WAIT_STEP, form: WAIT_FORM });
    open("If this step fails");
    const retry = screen.getByRole("radio", { name: "Retry, then stop" });

    act(() => {
      fireEvent.click(retry);
    });

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setFailure",
        step: WAIT_STEP.id,
        failure: { kind: "retry", retries: 3, seconds: 2, growing: true },
      },
    ]);
  });
});

describe("a duration", () => {
  it("is_an_amount_in_a_unit", () => {
    const { onEdit } = shown({ step: WAIT_STEP, form: WAIT_FORM });
    const amount = screen.getByRole("textbox", { name: /Wait for/ });

    leave(amount, "45");

    expect(amount).toHaveValue("45");
    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${WAIT_STEP.pointer}/wait`,
        value: { minutes: 45 },
      },
    ]);
  });
});
