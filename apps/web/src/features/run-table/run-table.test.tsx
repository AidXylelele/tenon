import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InstanceSummary, Phase } from "@/libs/data-access/types";
import { RunTable } from "./run-table";

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { readonly prefetch: boolean | null }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

const finished: InstanceSummary = {
  id: "run-1",
  namespace: "sales",
  name: "route-lead",
  version: "1.2.0",
  phase: "completed",
  trigger: "schedule",
  createdAt: "2026-11-03T09:00:00Z",
  startedAt: "2026-11-03T09:00:01Z",
  endedAt: "2026-11-03T09:01:31Z",
};

const pending: InstanceSummary = {
  id: "run-2",
  namespace: "billing",
  name: "charge-card",
  version: "0.1.0",
  phase: "pending",
  trigger: "manual",
  createdAt: "2026-11-03T10:00:00Z",
  startedAt: null,
  endedAt: null,
};

const nothing = <p>No runs yet</p>;

function PhaseWord({ phase }: { readonly phase: Phase }) {
  return <span>{phase}</span>;
}

function rows(): HTMLElement[] {
  const [, ...body] = screen.getAllByRole("row");
  return body;
}

function firstRow(): HTMLElement {
  const [row] = rows();

  if (row === undefined) throw new Error("The table has no row");

  return row;
}

describe("runs as a table", () => {
  it("each_run_is_a_row_that_opens_its_run", () => {
    render(
      <RunTable
        runs={[finished, pending]}
        Status={PhaseWord}
        empty={nothing}
      />,
    );
    const first = screen.getByRole("link", {
      name: "Succeeded run of route-lead, started 2026-11-03 09:00 UTC",
    });
    const second = screen.getByRole("link", {
      name: "Queued run of charge-card, started 2026-11-03 10:00 UTC",
    });

    expect(rows()).toHaveLength(2);
    expect(first).toHaveAttribute("href", "/runs/run-1");
    expect(second).toHaveAttribute("href", "/runs/run-2");
  });

  it("a_row_shows_the_phase_the_workflow_the_version_and_what_started_it", () => {
    render(<RunTable runs={[finished]} Status={PhaseWord} empty={nothing} />);
    const row = firstRow();
    const cells = within(row);

    expect(cells.getByText("completed")).toBeInTheDocument();
    expect(cells.getByText("route-lead")).toBeInTheDocument();
    expect(cells.getByText("sales")).toBeInTheDocument();
    expect(cells.getByText("1.2.0")).toBeInTheDocument();
    expect(cells.getByText("Schedule")).toBeInTheDocument();
  });

  it("a_run_is_dated_by_its_start_and_lasts_from_start_to_end", () => {
    render(<RunTable runs={[finished]} Status={PhaseWord} empty={nothing} />);
    const row = firstRow();
    const time = row.querySelector("time");

    expect(time).toHaveAttribute("dateTime", finished.startedAt);
    expect(within(row).getByText("1 min 30 s")).toBeInTheDocument();
  });

  it("a_run_not_yet_started_is_dated_by_its_creation_and_has_no_duration", () => {
    render(<RunTable runs={[pending]} Status={PhaseWord} empty={nothing} />);
    const row = firstRow();
    const cells = within(row);
    const time = row.querySelector("time");

    expect(time).toHaveAttribute("dateTime", pending.createdAt);
    expect(cells.getByText("—")).toBeInTheDocument();
    expect(cells.getByText("By hand")).toBeInTheDocument();
  });

  it("a_workflow_page_leaves_the_workflow_column_out", () => {
    render(
      <RunTable
        runs={[finished]}
        Status={PhaseWord}
        showWorkflow={false}
        empty={nothing}
      />,
    );

    expect(
      screen.queryByRole("columnheader", { name: "Workflow" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("sales")).not.toBeInTheDocument();
  });

  it("without_runs_the_page_shows_what_it_gave_instead_of_a_table", () => {
    render(<RunTable runs={[]} Status={PhaseWord} empty={nothing} />);

    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
