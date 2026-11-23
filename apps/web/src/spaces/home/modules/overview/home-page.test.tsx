import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ExpectedStarts,
  FailingWorkflow,
  InstanceCounts,
  PhaseCounts,
} from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { windowsOf } from "@/operations/run-periods";
import { HomePage, type HomePageProps } from "./home-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("./actions", () => ({ resumeAction: vi.fn(), turnAction: vi.fn() }));

const NOW = "2026-11-22T23:40:00.000Z";
const ZONE = "Europe/Kyiv";
const WINDOWS = windowsOf("7d", NOW, ZONE);

const NONE: PhaseCounts = {
  pending: 0,
  running: 0,
  waiting: 0,
  suspended: 0,
  completed: 0,
  faulted: 0,
  cancelled: 0,
};

const COUNTS: InstanceCounts & { readonly readAt: number } = {
  to: NOW,
  buckets: [],
  total: { ...NONE, completed: 50, faulted: 23 },
  previous: null,
  now: { pending: 0, running: 0, waiting: 0, suspended: 0 },
  readAt: Date.parse(NOW),
};

function failingOf(index: number): FailingWorkflow {
  const name = `flow-${String(index)}`;
  return {
    namespace: "sales",
    name,
    title: `Flow ${String(index)}`,
    failed: 7 - index,
    runs: 10,
    firstFailedAt: "2026-11-20T08:12:00.000Z",
    lastFailedAt: "2026-11-22T15:37:00.000Z",
    lastError: { status: 429, type: null, title: "Post", detail: null },
    stillFailing: true,
  };
}

const FAILING = [1, 2, 3, 4, 5, 6].map(failingOf);

const DIGEST: ExpectedStarts = {
  namespace: "news",
  name: "daily-digest",
  title: "Daily digest",
  lastRun: {
    id: "6c1f0b24-0000-4000-8000-000000000011",
    phase: "completed",
    createdAt: "2026-11-22T09:00:02.000Z",
  },
  schedule: { kind: "cron", cron: "0 9 * * *" },
  next: ["2026-11-23T09:00:00.000Z"],
  missed: 0,
  missedSince: "2026-11-16T22:00:00.000Z",
};

const PAGE: HomePageProps = {
  period: "7d",
  zone: ZONE,
  windows: WINDOWS,
  counts: COUNTS,
  failing: { items: FAILING, workflows: 6, failed: 21 },
  paused: [],
  expected: [DIGEST],
  operator: true,
  author: true,
};

function show(props: Partial<HomePageProps> = {}) {
  render(
    <TooltipProvider>
      <HomePage {...PAGE} {...props} />
    </TooltipProvider>,
  );
}

describe("home", () => {
  it("needs_attention_counts_the_failed_runs_of_the_figure_above", () => {
    show();

    const attention = within(
      screen.getByRole("region", { name: "Needs attention" }),
    );

    expect(
      attention.getByRole("link", { name: "All 23 failed runs" }),
    ).toBeInTheDocument();
    expect(
      attention.getByText(
        "6 workflows · 23 failed runs, the same as the figure above.",
      ),
    ).toBeInTheDocument();
  });

  it("needs_attention_shows_five_workflows_and_names_the_rest", () => {
    show();

    const attention = within(
      screen.getByRole("region", { name: "Needs attention" }),
    );

    expect(
      attention.getByRole("link", { name: "Flow 5: see its failed runs" }),
    ).toBeInTheDocument();
    expect(
      attention.queryByRole("link", { name: "Flow 6: see its failed runs" }),
    ).toBeNull();
    expect(
      attention.getByText(/\+ 1 more workflow failed:/),
    ).toBeInTheDocument();
    expect(attention.getByRole("link", { name: "Flow 6" })).toBeInTheDocument();
  });

  it("starts_automatically_reads_title_schedule_in_both_zones_last_run_and_its_switch", () => {
    show();

    const [section] = screen.getAllByRole("region", {
      name: "Starts automatically",
    });

    if (section === undefined) throw new Error("No Starts automatically");

    const starts = within(section);
    const headers = starts
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Workflow",
      "Starts (UTC)",
      "Last run",
      "Missed starts",
      "Automatic starts",
    ]);
    expect(starts.getByText("news/daily-digest")).toBeInTheDocument();
    expect(starts.getByText(/· 11:00 your time$/)).toBeInTheDocument();
    expect(starts.getByText("Succeeded")).toBeInTheDocument();
    expect(
      starts.getByRole("switch", { name: "Daily digest starts automatically" }),
    ).toBeChecked();
  });
});
