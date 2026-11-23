import { describe, expect, it } from "vitest";
import type { Phase } from "@/libs/data-access/types";
import type { RunStatus, Started } from "./interfaces";

const PHASE_WORDS: Readonly<Record<Phase, string>> = {
  pending: "Queued",
  running: "Running",
  waiting: "Waiting",
  suspended: "Paused",
  completed: "Succeeded",
  faulted: "Failed",
  cancelled: "Cancelled",
};

function phaseWord(phase: Phase): string {
  return PHASE_WORDS[phase];
}
import {
  phasesOf,
  statusOf,
  statusesOf,
  statusLabel,
  statusParamOf,
  summaryOf,
} from "./statuses";

describe("a run's status in the person's words, a single phase's in the words given", () => {
  it.each<[RunStatus, string, readonly Phase[]]>([
    [
      "in-progress",
      "In progress",
      ["pending", "running", "waiting", "suspended"],
    ],
    ["succeeded", "Succeeded", ["completed"]],
    ["failed", "Failed", ["faulted"]],
    ["cancelled", "Cancelled", ["cancelled"]],
  ])("%s_is_named_%s_and_counts_%o", (status, label, phases) => {
    const named = statusLabel(status, phaseWord);
    const counted = phasesOf(status);

    expect({ named, counted }).toEqual({ named: label, counted: phases });
  });
});

describe("the statuses in the address", () => {
  it.each<[readonly RunStatus[], string]>([
    [[], ""],
    [["failed"], "failed"],
    [["failed", "in-progress"], "in-progress,failed"],
    [["cancelled", "succeeded", "cancelled"], "succeeded,cancelled"],
  ])("%o_is_written_%s", (statuses, param) => {
    const written = statusParamOf(statuses);

    expect(written).toBe(param);
  });

  it.each<[string | undefined, readonly RunStatus[]]>([
    ["failed,in-progress", ["in-progress", "failed"]],
    ["failed,faulted,failed", ["failed"]],
    ["", []],
    [undefined, []],
  ])("status=%s_is_read_%o", (param, statuses) => {
    const read = statusesOf(param);

    expect(read).toEqual(statuses);
  });
});

describe("the line that sums up a list of runs", () => {
  it.each<[readonly RunStatus[], Started, string]>([
    [[], "all", "All runs at any time"],
    [[], "24h", "All runs in the last 24 hours"],
    [["failed"], "7d", "Failed in the last 7 days"],
    [["in-progress"], "all", "In progress at any time"],
    [
      ["failed", "in-progress"],
      "24h",
      "In progress or failed in the last 24 hours",
    ],
    [
      ["succeeded", "failed", "cancelled"],
      "30d",
      "Succeeded, failed or cancelled in the last 30 days",
    ],
  ])("%o_%s_reads_%s", (statuses, started, line) => {
    const summary = summaryOf(statuses, started, phaseWord);

    expect(summary).toBe(line);
  });
});

describe("the status that counts a phase", () => {
  it.each<[Phase, RunStatus]>([
    ["pending", "in-progress"],
    ["suspended", "in-progress"],
    ["completed", "succeeded"],
    ["faulted", "failed"],
    ["cancelled", "cancelled"],
  ])("%s_is_counted_in_%s", (phase, status) => {
    const counted = statusOf(phase);

    expect(counted).toBe(status);
  });
});
