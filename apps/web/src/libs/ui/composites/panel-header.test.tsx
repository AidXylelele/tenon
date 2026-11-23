import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../components/tooltip";
import { PanelHeader } from "./panel-header";

afterEach(() => {
  vi.useRealTimers();
});

describe("the header of a side panel", () => {
  it("it_names_the_panel_and_says_what_it_shows", () => {
    render(
      <PanelHeader
        title="Add a step"
        titleId="catalog"
        subtitle="After Fetch invoices"
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Add a step");
    expect(heading).toHaveAttribute("id", "catalog");
    const where = screen.getByText("After Fetch invoices");
    expect(where).toBeInTheDocument();
  });

  it("without_a_way_back_or_out_it_offers_no_buttons", () => {
    render(<PanelHeader title="Daily digest" />);

    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("close_asks_its_owner_to_close_the_panel", () => {
    const onClose = vi.fn();
    render(
      <TooltipProvider>
        <PanelHeader title="Add a step" onClose={onClose} />
      </TooltipProvider>,
    );
    const close = screen.getByRole("button", { name: "Close" });

    fireEvent.click(close);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("back_takes_its_owner_to_the_previous_view", () => {
    const onBack = vi.fn();
    render(
      <TooltipProvider>
        <PanelHeader
          title="Send invoice"
          onBack={onBack}
          backLabel="Back to the timeline"
        />
      </TooltipProvider>,
    );
    const back = screen.getByRole("button", { name: "Back to the timeline" });

    fireEvent.click(back);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("back_comes_before_the_title", () => {
    render(
      <TooltipProvider>
        <PanelHeader
          title="Send invoice"
          onBack={vi.fn()}
          backLabel="Back to the timeline"
        />
      </TooltipProvider>,
    );
    const back = screen.getByRole("button", { name: "Back to the timeline" });
    const heading = screen.getByRole("heading", { name: "Send invoice" });

    const order = back.compareDocumentPosition(heading);

    expect(order).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("a_hovered_close_button_names_itself_in_a_tooltip", () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider delayDuration={0}>
        <PanelHeader title="Add a step" onClose={vi.fn()} />
      </TooltipProvider>,
    );
    const close = screen.getByRole("button", { name: "Close" });

    act(() => {
      fireEvent.pointerMove(close, { pointerType: "mouse" });
      vi.runAllTimers();
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Close");
  });
});
