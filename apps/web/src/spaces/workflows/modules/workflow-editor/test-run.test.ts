import type { Step, Transition } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@/libs/data-access/types";
import { resultLineOf, stopOf } from "./test-run";

function transition(
  on: Transition["on"],
  name: string | null,
  kind: Transition["kind"],
): Transition {
  return { on, case: name, when: null, condition: null, kind, to: null };
}

function stepOf(
  name: string,
  kind: Step["kind"],
  summary: string | null,
  flow: readonly Transition[] = [transition("done", null, "next")],
): Step {
  return {
    id: `/do/${name}`,
    pointer: `/do/0/${name}`,
    name,
    kind,
    variant: null,
    family: "data",
    summary,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists: [],
    flow,
    catch: null,
  };
}

function recordOf(step: Step, change: Partial<TaskRecord> = {}): TaskRecord {
  return {
    execution: `${step.pointer}#0`,
    reference: step.pointer,
    name: step.name,
    status: "completed",
    error: null,
    startedAt: "2026-11-23T08:10:00.000Z",
    endedAt: "2026-11-23T08:10:00.512Z",
    attempt: 1,
    input: {},
    output: {},
    retryAt: null,
    ...change,
  };
}

const FETCH = stepOf(
  "Fetch the digest",
  "call",
  "GET https://httpbin.org/json",
);
const HAS_ITEMS = stepOf("Has items", "switch", null, [
  transition("case", "has items", "next"),
  transition("case", "default", "end"),
]);
const POST = stepOf("Post the items", "call", "POST https://httpbin.org/post");
const STEPS = [FETCH, HAS_ITEMS, POST];

describe("what a test run did", () => {
  it("a_run_that_reached_every_step_has_no_stop", () => {
    const records = STEPS.map((step) => recordOf(step));

    const stop = stopOf(records, STEPS);

    expect(stop).toBeNull();
  });

  it("a_choice_that_ended_the_run_names_the_branch_that_ends_it", () => {
    const records = [recordOf(FETCH), recordOf(HAS_ITEMS)];

    const stop = stopOf(records, STEPS);

    expect(stop).toEqual({
      title: "It stopped after “Has items”",
      detail:
        "“Has items” took “Otherwise”, which ends the run, so 1 step did not run: Post the items.",
    });
  });

  it("a_failed_step_is_where_it_stopped_and_why", () => {
    const error = { type: "x", status: 500, instance: "/", title: "Timed out" };
    const records = [recordOf(FETCH, { status: "faulted", error })];

    const stop = stopOf(records, STEPS);

    expect(stop?.detail).toBe(
      "“Fetch the digest” failed: Timed out, so 2 steps did not run: Has items, Post the items.",
    );
  });

  it("a_row_says_what_the_step_did_and_what_it_returned", () => {
    const output = { slideshow: {}, title: "x", slides: [1, 2] };
    const record = recordOf(FETCH, { output });

    const line = resultLineOf(FETCH, record);

    expect(line).toBe("GET https://httpbin.org/json → 3 fields");
  });

  it("a_row_of_a_list_counts_its_items_and_a_failure_names_its_error", () => {
    const listed = recordOf(POST, { output: [1, 2] });
    const error = { type: "x", status: 500, instance: "/", title: "Refused" };
    const failed = recordOf(POST, { status: "faulted", error });

    const lines = [resultLineOf(POST, listed), resultLineOf(POST, failed)];

    expect(lines).toEqual([
      "POST https://httpbin.org/post → 2 items",
      "Failed: Refused",
    ]);
  });
});
