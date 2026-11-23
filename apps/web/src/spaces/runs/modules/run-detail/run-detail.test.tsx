import type { Step } from "language-server/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Instance, TaskRecord } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { FaultStrip } from "./fault-strip";
import { RunFacts } from "./run-facts";
import { StepTabs } from "./step-tabs";
import { Timeline } from "./timeline";

const FAILED = {
  id: "7c1d2e3f-0000-4000-8000-000000000001",
  namespace: "news",
  name: "daily-digest",
  version: "1.0.0",
  phase: "faulted",
  trigger: "schedule",
  test: false,
  createdAt: "2026-11-22T21:00:02.000Z",
  startedAt: "2026-11-22T21:00:02.000Z",
  endedAt: "2026-11-22T21:00:02.708Z",
  input: {},
  output: null,
  error: {
    type: "https://open-workflow-specification.org/errors/communication",
    status: 429,
    instance: "/do/Post the items",
    title: "Post the items failed",
    detail:
      "the service answered 429 Too Many Requests — it limits how often it is called",
  },
  originId: null,
  startedBy: null,
  controls: ["restart", "delete"],
  cancelReason: null,
  waits: [],
} as const satisfies Instance;

const POST = {
  id: "post",
  pointer: "/do/Post the items",
  name: "Post the items",
} as unknown as Step;

const RECORD: TaskRecord = {
  execution: "/do/Post the items#1",
  reference: "/do/Post the items",
  name: "Post the items",
  status: "faulted",
  error: null,
  startedAt: "2026-11-22T21:00:02.420Z",
  endedAt: "2026-11-22T21:00:02.600Z",
  attempt: 1,
  input: {},
  output: null,
  retryAt: null,
};

describe("a failed run's banner", () => {
  it("names_the_step_says_why_and_offers_a_retry_and_the_step", () => {
    const onShow = vi.fn();
    render(
      <FaultStrip instance={FAILED} step={POST} canEdit onShow={onShow} />,
    );

    const retry = screen.getByRole("link", {
      name: "Add a retry to this step",
    });
    fireEvent.click(screen.getByRole("button", { name: "Show the step" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Post the items failed: the service answered 429 Too Many Requests — it limits how often it is called. Run again later, or add a retry to this step.",
    );
    expect(retry).toHaveAttribute(
      "href",
      "/workflows/news/daily-digest/edit?task=post",
    );
    expect(onShow).toHaveBeenCalledWith("post");
    expect(screen.queryByText("Open in editor")).toBeNull();
  });
});

describe("a run's timeline", () => {
  it("a_row_says_when_it_started_and_its_attempt_never_its_path", () => {
    render(
      <TooltipProvider>
        <Timeline records={[RECORD]} more={false} />
      </TooltipProvider>,
    );

    const row = screen.getByRole("listitem");

    expect(row).toHaveTextContent(/started .* · attempt 1/);
    expect(screen.queryByText("/do/Post the items#1")).toBeNull();
  });
});

describe("a run's facts", () => {
  it("are_one_line_of_dot_separated_facts_ending_with_the_run_id", () => {
    const { container } = render(
      <TooltipProvider>
        <RunFacts instance={FAILED} />
      </TooltipProvider>,
    );

    const facts = container.querySelector("p");

    expect(facts).toHaveTextContent(
      /^Version 1\.0\.0 · Started by its schedule · .* · took .* · run 7c1d2e3f-0000-4000-8000-000000000001$/,
    );
  });
});

describe("a chosen step's details", () => {
  it("a_failed_step_opens_on_its_error_then_input_and_output", () => {
    const failed = { ...RECORD, error: FAILED.error };
    render(<StepTabs record={failed} />);

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);

    expect(tabs).toEqual(["Error", "Input", "Output"]);
    expect(screen.getByRole("tab", { name: "Error" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("a_step_without_an_error_shows_its_input_and_output", () => {
    render(<StepTabs record={RECORD} />);

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);

    expect(tabs).toEqual(["Input", "Output"]);
  });
});
