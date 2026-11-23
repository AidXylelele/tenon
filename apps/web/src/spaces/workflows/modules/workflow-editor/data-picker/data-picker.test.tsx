import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import {
  AFTER_FETCH,
  AT_AN_ADDRESS,
  SAMPLES,
} from "./data-choices/data.test-support";
import { DataField } from "./data-field";
import { DataPicker } from "./data-picker";
import type { DataFieldProps, DataPickerProps } from "./interfaces";

function picker(props: Partial<DataPickerProps> = {}) {
  const onPick = vi.fn();
  const onWriteExpression = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Announcer>
      <DataPicker
        data={AFTER_FETCH}
        onPick={onPick}
        onWriteExpression={onWriteExpression}
        onOpenChange={onOpenChange}
        {...props}
      />
    </Announcer>,
  );
  return { onPick, onWriteExpression, onOpenChange };
}

function openPicker(name = "Insert data") {
  const trigger = screen.getByRole("button", { name });

  act(() => {
    fireEvent.click(trigger);
  });
}

function type(text: string) {
  const search = screen.getByRole("combobox", {
    name: "Find data, or type a field name",
  });

  act(() => {
    fireEvent.change(search, { target: { value: text } });
  });
}

function field(props: Partial<DataFieldProps> = {}) {
  const onText = vi.fn();
  const onUse = vi.fn();
  const onClear = vi.fn();
  render(
    <Announcer>
      <TooltipProvider>
        <label htmlFor="address">Address</label>
        <DataField
          pointer="/do/2/post/with/endpoint"
          value=""
          inputId="address"
          describedBy={undefined}
          invalid={false}
          placeholder="https://"
          data={AT_AN_ADDRESS}
          onText={onText}
          onUse={onUse}
          onClear={onClear}
          {...props}
        />
      </TooltipProvider>
    </Announcer>,
  );
  return { onText, onUse, onClear };
}

describe("the data picker", () => {
  it("opens_on_its_search_with_the_data_grouped_by_where_it_comes_from", () => {
    const { onOpenChange } = picker();

    openPicker();

    const search = screen.getByRole("combobox", {
      name: "Find data, or type a field name",
    });
    expect(search).toHaveFocus();
    const fromGreet = screen.getByText("From Greet");
    expect(fromGreet).toBeInTheDocument();
    const datesAndTimes = screen.getByText("Dates and times");
    expect(datesAndTimes).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("a_pick_reports_the_value_and_the_step_to_export_and_closes", () => {
    const { onPick } = picker();
    openPicker();
    const message = screen.getByRole("option", { name: /Greet › message/ });

    act(() => {
      fireEvent.click(message);
    });

    expect(onPick).toHaveBeenCalledWith({
      label: "Greet › message",
      value: "${ $context.Greet.message }",
      expression: "$context.Greet.message",
      export: "/do/Greet",
      secret: false,
    });
    const option = screen.queryByRole("option");
    expect(option).toBeNull();
  });

  it("a_secret_is_picked_as_a_secret", () => {
    const { onPick } = picker({ data: AT_AN_ADDRESS });
    openPicker();
    const secret = screen.getByRole("option", { name: /SLACK_WEBHOOK_URL/ });

    act(() => {
      fireEvent.click(secret);
    });

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ secret: true, export: null }),
    );
  });

  it("typing_keeps_what_matches_and_says_how_much", () => {
    picker({ samples: SAMPLES });
    openPicker();

    type("title");

    const options = screen.getAllByRole("option");
    const texts = options.map((option) => option.textContent);
    expect(texts).toEqual([
      "Fetch the digest › slideshow › titletext",
      "Fetch the digest › titlea field of the answer",
      "Greet › titlea field of the answer",
    ]);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("3 pieces of data");
  });

  it("one_match_is_said_as_one_piece", () => {
    picker({ samples: SAMPLES });
    openPicker();

    type("slideshow › slides");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("1 piece of data");
  });

  it("nothing_that_matches_is_said", () => {
    picker();
    openPicker();

    type("a b");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Nothing matches “a b”.");
  });

  it("writing_an_expression_closes_the_picker_and_hands_over", () => {
    const { onWriteExpression } = picker();
    openPicker();
    const write = screen.getByRole("button", { name: "Write an expression" });

    act(() => {
      fireEvent.click(write);
    });

    expect(onWriteExpression).toHaveBeenCalledOnce();
    const option = screen.queryByRole("option");
    expect(option).toBeNull();
  });

  it("while_the_data_is_read_it_says_so", () => {
    picker({ data: null, onWriteExpression: undefined });
    openPicker();

    const reading = screen.getByText(
      "Reading the data that reaches this step…",
    );

    expect(reading).toBeInTheDocument();
    const writeAnExpression = screen.queryByRole("button", {
      name: "Write an expression",
    });
    expect(writeAnExpression).toBeNull();
  });

  it("only_paths_leave_out_the_times", () => {
    picker({ onlyPaths: true, label: "Choose data" });
    openPicker("Choose data");

    const times = screen.queryByText("Dates and times");

    expect(times).toBeNull();
  });
});

describe("a field that takes data", () => {
  it("typed_text_is_reported_when_left", () => {
    const { onText } = field();
    const address = screen.getByRole("textbox", { name: "Address" });

    act(() => {
      fireEvent.change(address, { target: { value: "https://a.example" } });
      fireEvent.blur(address);
    });

    expect(onText).toHaveBeenCalledWith("https://a.example");
  });

  it("data_picked_is_reported_as_its_use", () => {
    const { onUse } = field();
    openPicker();
    const input = screen.getByRole("option", { name: /The workflow's input/ });

    act(() => {
      fireEvent.click(input);
    });

    expect(onUse).toHaveBeenCalledWith({
      value: "${ $workflow.input }",
      export: null,
    });
  });

  it("a_value_holding_offered_data_is_a_chip_named_in_words", () => {
    field({
      value: "${ .slideshow.slides }",
      data: AFTER_FETCH,
      samples: SAMPLES,
    });

    const chip = screen.getByRole("button", {
      name: "Fetch the digest › slideshow › slides, change",
    });

    expect(chip).toHaveTextContent("Fetch the digest › slideshow › slides");
    const textbox = screen.queryByRole("textbox");
    expect(textbox).toBeNull();
  });

  it("a_secret_chip_is_masked_and_says_it_stays_out_of_run_records", () => {
    field({ value: "${ $secrets.SLACK_WEBHOOK_URL }" });

    const chip = screen.getByRole("button", {
      name: "SLACK_WEBHOOK_URL, a secret kept out of run records, change",
    });

    expect(chip).toHaveTextContent("•••• SLACK_WEBHOOK_URL");
  });

  it("the_chip_opens_the_picker_to_change_it", () => {
    field({ value: "${ $secrets.SLACK_WEBHOOK_URL }" });
    const chip = screen.getByRole("button", {
      name: "SLACK_WEBHOOK_URL, a secret kept out of run records, change",
    });

    act(() => {
      fireEvent.click(chip);
    });

    const findData = screen.getByRole("combobox", { name: /Find data/ });
    expect(findData).toHaveFocus();
  });

  it("removing_the_chip_clears_the_field_and_keeps_focus_on_insert_data", () => {
    const { onClear } = field({ value: "${ $secrets.SLACK_WEBHOOK_URL }" });
    const remove = screen.getByRole("button", {
      name: "Remove SLACK_WEBHOOK_URL",
    });

    act(() => {
      fireEvent.click(remove);
    });

    expect(onClear).toHaveBeenCalledOnce();
    const insertData = screen.getByRole("button", { name: "Insert data" });
    expect(insertData).toHaveFocus();
  });

  it("write_an_expression_shows_the_value_as_text_to_edit", () => {
    field({ value: "${ $secrets.SLACK_WEBHOOK_URL }" });
    openPicker();
    const write = screen.getByRole("button", { name: "Write an expression" });

    act(() => {
      fireEvent.click(write);
    });

    const text = screen.getByRole("textbox", { name: "Address" });
    expect(text).toHaveValue("${ $secrets.SLACK_WEBHOOK_URL }");
    expect(text).toHaveFocus();
  });

  it("an_expression_of_no_offered_data_stays_text", () => {
    field({ value: "${ now | todate }", data: null });

    const text = screen.getByRole("textbox", { name: "Address" });

    expect(text).toHaveValue("${ now | todate }");
  });
});
