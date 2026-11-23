import { fireEvent, render, screen } from "@testing-library/react";
import type { Step, Transition } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import type { TestRun } from "./interfaces";
import { TestRunPanel } from "./test-run-panel";
import type { TestRunState } from "./use-test-run";

const DONE: Transition = {
  on: "done",
  case: null,
  when: null,
  condition: null,
  kind: "next",
  to: null,
};

function stepOf(name: string, summary: string): Step {
  return {
    id: `/do/${name}`,
    pointer: `/do/0/${name}`,
    name,
    kind: "call",
    variant: null,
    family: "call",
    summary,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists: [],
    flow: [DONE],
    catch: null,
  };
}

const FETCH = stepOf("Fetch the digest", "GET https://httpbin.org/json");
const POST = stepOf("Post the items", "POST https://httpbin.org/post");
const STEPS = [FETCH, POST];

function recordOf(step: Step): TaskRecord {
  return {
    execution: `${step.pointer}#0`,
    reference: step.pointer,
    name: step.name,
    status: "completed",
    error: null,
    startedAt: "2026-11-23T08:10:00.000Z",
    endedAt: "2026-11-23T08:10:00.512Z",
    attempt: 1,
    input: { asked: true },
    output: { title: "x", slides: [] },
    retryAt: null,
  };
}

function ranWith(records: readonly TaskRecord[], phase: string): TestRunState {
  const run = {
    id: "run-1",
    phase,
    startedAt: "2026-11-23T08:10:00.000Z",
    endedAt: "2026-11-23T08:10:00.700Z",
  };
  const test = { run, records } as unknown as TestRun;
  return { kind: "ran", test };
}

function show(state: TestRunState, lost = false) {
  const onReadAgain = vi.fn();
  render(
    <TooltipProvider>
      <Announcer>
        <TestRunPanel
          state={state}
          lost={lost}
          steps={STEPS}
          onRun={vi.fn()}
          onAgain={vi.fn()}
          onReadAgain={onReadAgain}
          onBack={vi.fn()}
        />
      </Announcer>
    </TooltipProvider>,
  );
  return { onReadAgain };
}

describe("the test run panel", () => {
  it("before_a_run_only_the_header_leads_back", () => {
    show({ kind: "idle" });

    const back = screen.getAllByRole("button", { name: /Back/ });

    expect(back).toHaveLength(1);
  });

  it("a_run_that_reached_every_step_says_it_succeeded_and_how_long_it_took", () => {
    show(ranWith(STEPS.map(recordOf), "completed"));

    const banner = screen.getByRole("alert");

    expect(banner).toHaveTextContent("Test run succeeded in 700 ms");
  });

  it("a_run_that_stopped_early_warns_where_and_why", () => {
    show(ranWith([recordOf(FETCH)], "completed"));

    const banner = screen.getByRole("alert");

    expect(banner).toHaveTextContent("It stopped after “Fetch the digest”");
    expect(banner).toHaveTextContent(
      "The run ended after “Fetch the digest”, so 1 step did not run: Post the items.",
    );
  });

  it("a_row_says_what_the_step_did_and_how_long_then_opens_on_what_it_received", () => {
    show(ranWith([recordOf(FETCH)], "completed"));

    const row = screen.getByRole("button", { name: /Fetch the digest/ });
    fireEvent.click(row);

    expect(row).toHaveTextContent("GET https://httpbin.org/json → 2 fields");
    expect(row).toHaveTextContent("512 ms");
    expect(row.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-23T08:10:00.000Z",
    );
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("What it received")).toBeVisible();
  });

  it("a_progress_that_cannot_be_read_is_never_shown_as_running", () => {
    const { onReadAgain } = show(ranWith([], "running"), true);

    const lost = screen.getByText("The test run's progress could not be read");
    fireEvent.click(screen.getByRole("button", { name: "Read it again" }));

    expect(lost).toBeVisible();
    expect(screen.queryByText("The test run is running…")).toBeNull();
    expect(onReadAgain).toHaveBeenCalled();
  });
});
