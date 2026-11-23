import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MONTH_END } from "@/features/workflow-flow/workflows.test-support";
import { SummaryPanel } from "./summary-panel";

const STRUCTURE = { version: 1, stale: false, workflow: MONTH_END };

function show() {
  const onSelect = vi.fn();
  const onEdit = vi.fn();
  render(
    <SummaryPanel
      structure={STRUCTURE}
      title="Month-end billing"
      status="Draft saved"
      marks={new Map()}
      tested={false}
      onSelect={onSelect}
      onTest={vi.fn()}
      onEdit={onEdit}
    />,
  );
  return { onSelect, onEdit };
}

describe("the workflow's summary", () => {
  it("edits_the_title_as_the_document's_title", () => {
    const { onEdit } = show();
    const title = screen.getByRole("textbox", { name: "Title" });

    fireEvent.change(title, { target: { value: "Month-end close" } });
    fireEvent.blur(title);

    expect(onEdit).toHaveBeenCalledWith([
      {
        kind: "setField",
        pointer: "/document/title",
        value: "Month-end close",
      },
    ]);
  });

  it("starts_with_a_button_that_shows_its_icon_and_opens_the_start", () => {
    const { onSelect } = show();
    const starts = screen.getByRole("button", { name: "Starts by hand" });

    fireEvent.click(starts);

    expect(starts.querySelector("svg")).not.toBeNull();
    expect(onSelect).toHaveBeenCalledWith("start");
  });

  it("outlines_the_steps_with_their_kind_icons_nested_under_their_blocks", () => {
    show();

    const outline = screen.getByRole("list", { name: "Steps" });
    const nested = outline.querySelectorAll("ul");
    const icons = outline.querySelectorAll("button svg");

    expect(nested.length).toBeGreaterThan(0);
    expect(icons.length).toBeGreaterThan(0);
  });
});
