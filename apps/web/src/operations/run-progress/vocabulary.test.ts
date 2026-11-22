import { describe, expect, it } from "vitest";
import type { Phase, Trigger } from "@/libs/data-access/types";
import type { StepState } from "./interfaces";
import {
  isUnended,
  phaseLabel,
  startedBy,
  stepStateLabel,
  triggerLabel,
} from "./vocabulary";

describe("a run that has not ended", () => {
  it.each([
    ["pending", true],
    ["running", true],
    ["waiting", true],
    ["suspended", true],
    ["completed", false],
    ["faulted", false],
    ["cancelled", false],
  ] as const)("a_%s_run_is_unended_%s", (phase: Phase, unended) => {
    const answer = isUnended(phase);

    expect(answer).toBe(unended);
  });
});

describe("a run's phase in the console's words", () => {
  it.each<[Phase, string]>([
    ["pending", "Queued"],
    ["running", "Running"],
    ["waiting", "Waiting"],
    ["suspended", "Paused"],
    ["completed", "Succeeded"],
    ["faulted", "Failed"],
    ["cancelled", "Cancelled"],
  ])("%s_reads_%s", (phase, word) => {
    const label = phaseLabel(phase);

    expect(label).toBe(word);
  });
});

describe("a step's state in the console's words", () => {
  it.each<[StepState, string]>([
    ["completed", "Succeeded"],
    ["faulted", "Failed"],
    ["retrying", "Retrying"],
    ["skipped", "Skipped"],
    ["not-reached", "Not reached"],
  ])("%s_reads_%s", (state, word) => {
    const label = stepStateLabel(state);

    expect(label).toBe(word);
  });
});

describe("how a run started", () => {
  it.each<[Trigger, string, string]>([
    ["manual", "By hand", "Started by hand"],
    ["schedule", "Schedule", "Started by its schedule"],
    ["event", "Event", "Started by an event"],
    ["parent", "Parent run", "Started by a parent run"],
    ["detached", "Detached from a run", "Started detached from a run"],
    ["restart", "Run again", "Run again by hand"],
  ])("%s_reads_%s_and_%s", (trigger, short, long) => {
    const named = triggerLabel(trigger);
    const started = startedBy(trigger);

    expect({ named, started }).toEqual({ named: short, started: long });
  });
});
