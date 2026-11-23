import { describe, expect, it } from "vitest";
import type { Phase } from "@/libs/data-access/types";
import type { RunStatus } from "./interfaces";
import {
  isUnended,
  phasesOf,
  runsPhraseOf,
  statusOf,
  statusesOf,
  statusParamOf,
} from "./statuses";
import { statusLabel } from "./vocabulary";

describe("a run's status in the person's words", () => {
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
    const named = statusLabel(status);
    const counted = phasesOf(status);

    expect({ named, counted }).toEqual({ named: label, counted: phases });
  });
});

describe("a run that has not ended", () => {
  it.each<[Phase, boolean]>([
    ["pending", true],
    ["running", true],
    ["waiting", true],
    ["suspended", true],
    ["completed", false],
    ["faulted", false],
    ["cancelled", false],
  ])("a_%s_run_is_unended_%s", (phase, unended) => {
    const answer = isUnended(phase);

    expect(answer).toBe(unended);
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

describe("the runs a list of statuses names", () => {
  it.each<[readonly RunStatus[], string]>([
    [[], "All runs"],
    [["failed"], "Failed"],
    [["in-progress"], "In progress"],
    [["failed", "in-progress"], "In progress or failed"],
    [["succeeded", "failed", "cancelled"], "Succeeded, failed or cancelled"],
  ])("%o_reads_%s", (statuses, line) => {
    const runs = runsPhraseOf(statuses);

    expect(runs).toBe(line);
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
