import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EditAction } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
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
import { FIRST_RETRY } from "../form-fields";
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
    <Announcer>
      <TooltipProvider>
        <StepForm {...all} />
      </TooltipProvider>
    </Announcer>,
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

function open(title: string) {
  const header = screen.getByRole("button", { name: title });

  act(() => {
    fireEvent.click(header);
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
    const more = screen.getByRole("button", { name: "More options" });
    const headers = screen.queryByLabelText(/Headers/);

    expect(method).toHaveAttribute("aria-checked", "true");
    expect(address).toHaveValue("https://httpbin.org/json");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(headers).toBeNull();
  });

  it("an_address_to_fill_says_fill_in_and_no_error_yet", () => {
    shown({ step: POST_STEP, form: POST_FORM });
    const address = screen.getByLabelText("Address");

    const fill = screen.getByText("Fill in");

    expect(fill).toBeInTheDocument();
    expect(address).toHaveAccessibleDescription("Fill in");
    const alert = screen.queryByRole("alert");
    expect(alert).toBeNull();
  });

  it("an_address_left_empty_says_how_to_fill_it", () => {
    shown({ step: POST_STEP, form: POST_FORM });
    const address = screen.getByLabelText("Address");

    leave(address, "");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Enter the address to call, for example https://api.example.com/orders",
    );
    expect(address).toHaveAttribute("aria-invalid", "true");
    const fillIn = screen.queryByText("Fill in");
    expect(fillIn).toBeNull();
  });

  it("test_or_publish_shows_every_problem_at_once", () => {
    shown({ step: POST_STEP, form: POST_FORM, revealProblems: true });

    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("Enter the address to call");
    const fillIn = screen.queryByText("Fill in");
    expect(fillIn).toBeNull();
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

  it("the_sections_come_in_order_and_data_in_and_out_only_with_language_terms", () => {
    shown({ languageTerms: true });

    const headers = screen.getAllByRole("button", { expanded: false });
    const titles = headers.map((header) => header.textContent);

    expect(titles).toEqual([
      expect.stringContaining("More options"),
      expect.stringContaining("If this step fails"),
      expect.stringContaining("Data in and out"),
    ]);
  });

  it("without_language_terms_data_in_and_out_is_not_offered", () => {
    shown();

    const data = screen.queryByRole("button", { name: "Data in and out" });

    expect(data).toBeNull();
  });

  it("a_time_limit_is_written_in_seconds", () => {
    const { onEdit } = shown();
    open("More options");
    const limit = screen.getByRole("textbox", { name: /Time limit, seconds/ });

    leave(limit, "1.5");
    const refusal = screen.getByRole("alert").textContent;
    leave(limit, "45");

    expect(refusal).toBe("Write the seconds as a whole number above 0.");
    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: `${FETCH_STEP.pointer}/timeout`,
        value: { after: { seconds: 45 } },
      },
    ]);
  });

  it("headers_are_named_values_and_notes_and_redirects_are_not_offered", () => {
    shown();
    open("More options");

    const add = screen.getByRole("button", { name: "Add a value" });
    const notes = screen.queryByText("Notes");
    const redirects = screen.queryByText("Follow redirects");

    expect(add).toBeInTheDocument();
    expect(notes).toBeNull();
    expect(redirects).toBeNull();
  });

  it("a_choice_with_a_usual_value_is_not_called_optional", () => {
    shown();
    open("More options");

    const result = screen.getByRole("combobox", { name: "The step's result" });
    const limit = screen.getByRole("textbox", { name: "Time limit, seconds" });

    expect(result).toHaveAccessibleName("The step's result");
    expect(limit).toBeInTheDocument();
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

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Give the step a name.");
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
    const help = "Skip the step unless the condition holds.";
    expect(add).toHaveAccessibleDescription(help);

    act(() => {
      fireEvent.click(add);
    });

    const builder = screen.getByText("The builder");
    const slot = expect.objectContaining({
      pointer: `${FETCH_STEP.pointer}/if`,
      text: "",
      describedBy: expect.any(String),
      invalid: false,
    });
    expect(builder).toBeInTheDocument();
    expect(renderCondition).toHaveBeenCalledWith(slot);
  });

  it("the_code_of_a_script_goes_to_the_code_slot_with_its_language", () => {
    const renderCode = vi.fn(() => <p>The code editor</p>);
    shown({ step: SCRIPT_STEP, form: SCRIPT_FORM, renderCode });

    const theCodeEditor = screen.getByText("The code editor");
    expect(theCodeEditor).toBeInTheDocument();
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

    const conditionOfHas = within(branch).getByRole("textbox", {
      name: "Condition of Has items",
    });
    expect(conditionOfHas).toBeInTheDocument();
    const otherwiseThen = within(otherwise).getByRole("combobox", {
      name: "Then",
    });
    expect(otherwiseThen).toHaveTextContent("End the run");
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

    const writtenAsAn = screen.getByText(/written as an expression/);
    expect(writtenAsAn).toBeInTheDocument();
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

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Another value is already named “count”.");
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

describe("how a call sends its data", () => {
  it("a_message_is_the_usual_and_its_text_is_set_at_its_place", () => {
    const { onEdit } = shown({ step: POST_STEP, form: POST_FORM });
    const message = screen.getByRole("radio", { name: "Message" });
    const text = screen.getByRole("textbox", { name: /^Data/ });

    leave(text, "The digest is ready");

    const pointer = `${POST_STEP.pointer}/with/body/text`;
    expect(message).toHaveAttribute("aria-checked", "true");
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer, value: "The digest is ready" },
    ]);
  });

  it("form_fields_write_their_content_type", () => {
    const { onEdit } = shown({ step: POST_STEP, form: POST_FORM });
    const form = screen.getByRole("radio", { name: "Form fields" });

    act(() => {
      fireEvent.click(form);
    });

    const pointer = `${POST_STEP.pointer}/with/headers`;
    const value = { "Content-Type": "application/x-www-form-urlencoded" };
    const body = `${POST_STEP.pointer}/with/body`;
    expect(onEdit).toHaveBeenCalledWith([
      { kind: "setField", pointer, value },
      { kind: "setField", pointer: body, value: {} },
    ]);
  });
});

describe("a script's result", () => {
  it("comes_after_the_code_and_before_the_data_the_script_gets", () => {
    shown({ step: SCRIPT_STEP, form: SCRIPT_FORM });

    const code = screen.getByRole("textbox", { name: "Code" });
    const result = screen.getByRole("combobox", { name: "The step's result" });
    const data = screen.getByText("Data the script gets");

    const afterCode = code.compareDocumentPosition(result);
    const beforeData = result.compareDocumentPosition(data);
    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(afterCode & following).toBe(following);
    expect(beforeData & following).toBe(following);
  });

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
        failure: {
          kind: "retry",
          retry: { ...FIRST_RETRY, retries: 5 },
        },
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
        failure: {
          kind: "retry",
          retry: { ...FIRST_RETRY, backoff: "constant" },
        },
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
    const pressTheLane = screen.getByText(/press the lane's \+/);
    expect(pressTheLane).toBeInTheDocument();
  });

  it("a_retry_on_statuses_is_written_from_the_typed_list", () => {
    const { onEdit } = shown({
      step: REPORT_INNER_STEP,
      form: REPORT_FORM,
      protection: RETRYING,
    });
    open("If this step fails");
    const when = screen.getByRole("combobox", { name: "Retry when" });

    choose(when, "The answer has one of these statuses");
    const statuses = screen.getByRole("textbox", { name: "Statuses" });
    leave(statuses, "503, 429");

    const on = { kind: "statuses", statuses: [503, 429] };
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setFailure",
        step: REPORT_STEP.id,
        failure: { kind: "retry", retry: { ...FIRST_RETRY, on } },
      },
    ]);
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
        failure: { kind: "retry", retry: FIRST_RETRY },
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
