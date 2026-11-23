import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { runsAddressOf } from "./runs-address";
import { RunsPage, type RunsPageProps } from "./runs-page";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const PAGE: RunsPageProps = {
  address: runsAddressOf({ started: "7d" }),
  zone: "UTC",
  page: { items: [], total: 0, exact: true, readAt: 0 },
  workflows: [{ namespace: "sales", name: "route-lead" }],
  operator: true,
};

function show(props: Partial<RunsPageProps> = {}) {
  render(
    <TooltipProvider>
      <RunsPage {...PAGE} {...props} />
    </TooltipProvider>,
  );
}

describe("the runs page", () => {
  it("the_summary_is_a_heading_inside_a_live_region", () => {
    show();

    const status = screen.getByRole("status");

    expect(within(status).getByRole("heading", { level: 2 })).toHaveTextContent(
      "All runs in the last 7 days · 0",
    );
  });

  it("the_period_comes_first_under_started_and_a_period_alone_is_not_cleared", () => {
    show();

    const filters = within(screen.getByRole("group", { name: "Filters" }));
    const day = filters.getByRole("radio", { name: "24 hours" });
    const workflow = filters.getByRole("combobox", { name: "Workflow" });
    const order = day.compareDocumentPosition(workflow);

    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filters.getByText("Started")).toBeVisible();
    expect(filters.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("the_status_is_any_status_a_menu_of_several_with_the_in_progress_phases", () => {
    show();

    const any = screen.getByRole("button", { name: "Any status" });
    fireEvent.pointerDown(any, { button: 0, ctrlKey: false });
    const failed = screen.getByRole("menuitemcheckbox", { name: "Failed" });
    const live = screen.getByRole("menuitemcheckbox", { name: /In progress/ });
    fireEvent.click(failed);

    expect(live).toHaveTextContent("queued, running, waiting, paused");
    expect(replace).toHaveBeenCalledWith("/runs?status=failed&started=7d");
  });

  it("a_chosen_status_names_the_button_and_can_be_cleared", () => {
    show({ address: runsAddressOf({ started: "7d", status: "failed" }) });

    expect(screen.getByRole("button", { name: "Failed" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });
});
