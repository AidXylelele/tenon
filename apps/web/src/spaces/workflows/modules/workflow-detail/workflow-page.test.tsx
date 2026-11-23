import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  DAILY_DIGEST,
  MONTH_END,
  NO_RUNS,
  ORDER_ROUTER,
  ROUTER_COUNTS,
  ROUTER_RUNS,
  ROUTER_STRUCTURE,
  ROUTER_VERSIONS,
} from "../../__shared_context/workflows.test-support";
import { visit } from "@/libs/routing/navigation.test-support";
import { WorkflowPage, type WorkflowPageProps } from "./workflow-page";

const { turnAction, archiveAction, success } = vi.hoisted(() => ({
  turnAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  archiveAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  success: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  const address = await import("@/libs/routing/navigation.test-support");
  return { ...address, useRouter: () => ({ push: vi.fn() }) };
});
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));
vi.mock("./actions", () => ({ turnAction, archiveAction }));
vi.mock("../../__shared_context/start-dialog/actions", () => ({
  startAction: vi.fn(),
}));
vi.mock("@/features/workflow-flow", () => ({
  WorkflowFlow: () => <section aria-label="The flow" />,
}));
vi.mock("@/features/runs-chart", async (original) => ({
  ...(await original<typeof import("@/features/runs-chart")>()),
  RunsChart: () => <section aria-label="Runs chart" />,
}));

const PAGE: WorkflowPageProps = {
  workflow: ORDER_ROUTER,
  tab: "overview",
  versions: ROUTER_VERSIONS,
  runs: ROUTER_RUNS,
  structure: ROUTER_STRUCTURE,
  author: true,
  operator: true,
  ...ROUTER_COUNTS,
};

function show(props: Partial<WorkflowPageProps> = {}) {
  render(
    <TooltipProvider>
      <WorkflowPage {...PAGE} {...props} />
    </TooltipProvider>,
  );
}

function openMenu() {
  const more = screen.getByRole("button", { name: "More actions" });
  fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
}

describe("a workflow's page", () => {
  beforeEach(() => {
    visit("/workflows/sales/order-router");
    turnAction.mockReset();
    archiveAction.mockReset();
    success.mockReset();
  });

  it("the_overview_counts_the_period_with_its_chart_and_the_period_sits_left_of_edit", () => {
    show();

    const week = screen.getByRole("radio", { name: "7 days" });
    const edit = screen.getByRole("link", { name: "Edit" });
    const failed = screen.getByRole("link", { name: /^Failed/ });
    const order = week.compareDocumentPosition(edit);

    expect(week).toHaveAttribute("aria-checked", "true");
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(failed).toHaveAttribute(
      "href",
      "/runs?namespace=sales&name=order-router&status=failed&started=7d",
    );
    expect(screen.getByRole("region", { name: "Runs chart" })).toBeVisible();
  });

  it("the_versions_tab_and_the_header_count_the_runs_of_each_version", () => {
    show({ tab: "versions" });

    const runs = screen.getByRole("columnheader", { name: "Runs" });

    expect(runs).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "24" })).toBeInTheDocument();
    expect(screen.getByText(/version 1\.2\.0, 24 runs/)).toBeInTheDocument();
  });

  it("an_editor_edits_runs_and_finds_the_rest_under_more", () => {
    show();

    const edit = screen.getByRole("link", { name: "Edit" });
    const run = screen.getByRole("button", { name: "Run" });
    expect(edit).toHaveAttribute("href", "/workflows/sales/order-router/edit");
    expect(run).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Order router",
    );
  });

  it("the_meta_line_names_the_version_and_who_published_it", () => {
    show();

    const meta = screen.getByText(/published by Administrator/);
    expect(meta).toHaveTextContent("version 1.2.0, 24 runs");
  });

  it("the_overview_shows_the_flow_and_the_recent_runs", () => {
    show();

    const flow = screen.getByRole("region", { name: "The flow" });
    const version = screen.getByRole("link", { name: "Open version 1.2.0" });
    expect(flow).toBeInTheDocument();
    expect(version).toHaveAttribute(
      "href",
      "/workflows/sales/order-router/versions/1.2.0",
    );
  });

  it("a_viewer_reads_and_downloads_but_changes_nothing", () => {
    show({ author: false, operator: false });

    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run" })).toBeNull();
    expect(screen.getByText("Viewers read workflows and runs.")).toBeVisible();
    openMenu();
    expect(
      screen.getByRole("menuitem", { name: "Download YAML" }),
    ).toHaveAttribute(
      "href",
      "/workflows/sales/order-router/versions/1.2.0/source",
    );
    expect(screen.queryByRole("menuitem", { name: "Archive…" })).toBeNull();
  });

  it("a_workflow_never_published_offers_the_editor_and_no_run", () => {
    show({
      workflow: MONTH_END,
      versions: [],
      runs: NO_RUNS,
      structure: null,
    });

    expect(screen.getByText("Nothing is published yet")).toBeVisible();
    expect(screen.getByText(/Not published yet/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Run" })).toBeNull();
  });

  it("an_archived_workflow_says_so_and_takes_no_change", () => {
    const archived = { ...ORDER_ROUTER, status: "archived" as const };
    show({ workflow: archived });

    expect(screen.getByText("Archived")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run" })).toBeNull();
  });

  it("the_versions_tab_lists_each_version_with_the_current_one_marked", () => {
    show({ tab: "versions" });

    const current = screen.getByRole("link", { name: "1.2.0" });
    const row = current.closest("tr");
    expect(row).toHaveTextContent("Current");
    expect(screen.getByRole("link", { name: "1.1.0" })).toBeVisible();
  });

  it("a_scheduled_workflow_turns_off_with_undo_in_the_toast", async () => {
    turnAction.mockResolvedValue({ ok: true, value: undefined });
    show({ workflow: DAILY_DIGEST });

    const starts = screen.getByRole("switch", { name: "Starts automatically" });
    fireEvent.click(starts);

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith(
        "Automatic starts turned off for Daily digest",
        expect.objectContaining({ duration: Infinity }),
      );
    });
    expect(turnAction).toHaveBeenCalledWith("default", "daily-digest", false);
  });

  it("a_refused_turn_says_why_beside_the_switch", async () => {
    turnAction.mockResolvedValue({
      ok: false,
      problem: { detail: "Only editors turn starts on and off." },
    });
    show({ workflow: DAILY_DIGEST });

    fireEvent.click(
      screen.getByRole("switch", { name: "Starts automatically" }),
    );

    const why = await screen.findByRole("alert");
    expect(why).toHaveTextContent("Only editors turn starts on and off.");
  });

  it("keep_it_gives_the_focus_back_to_more_actions", async () => {
    show();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep it" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "More actions" }),
      ).toHaveFocus();
    });
    expect(archiveAction).not.toHaveBeenCalled();
  });

  it("the_versions_tab_runs_an_earlier_version_from_its_row", () => {
    show({ tab: "versions" });

    const row = screen.getByRole("link", { name: "1.1.0" }).closest("tr");
    const run = within(row ?? document.body).getByRole("button", {
      name: "Run this version",
    });
    fireEvent.click(run);

    expect(window.location.search).toBe("?start=1&version=1.1.0");
  });

  it("archiving_asks_with_keep_it_focused_then_archives", async () => {
    archiveAction.mockResolvedValue({ ok: true, value: undefined });
    show();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive…" }));
    const keep = await screen.findByRole("button", { name: "Keep it" });
    expect(keep).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Archive workflow" }));

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith("order-router archived");
    });
    expect(archiveAction).toHaveBeenCalledWith("sales", "order-router");
  });
});
