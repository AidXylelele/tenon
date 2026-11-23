import type { Phase, Trigger } from "@/libs/data-access/types";
import type { StepState } from "./interfaces";

const PHASE: Record<Phase, string> = {
  pending: "Queued",
  running: "Running",
  waiting: "Waiting",
  suspended: "Paused",
  completed: "Succeeded",
  faulted: "Failed",
  cancelled: "Cancelled",
};

const STEP_STATE: Record<StepState, string> = {
  ...PHASE,
  retrying: "Retrying",
  skipped: "Skipped",
  "not-reached": "Not reached",
};

export const PHASES = Object.keys(PHASE) as Phase[];

export function phaseLabel(phase: Phase): string {
  return PHASE[phase];
}

export function isUnended(phase: Phase): boolean {
  return (
    phase === "pending" ||
    phase === "running" ||
    phase === "waiting" ||
    phase === "suspended"
  );
}

export function stepStateLabel(state: StepState): string {
  return STEP_STATE[state];
}

const TRIGGER: Record<Trigger, string> = {
  manual: "By hand",
  schedule: "Schedule",
  event: "Event",
  parent: "Parent run",
  detached: "Detached from a run",
  restart: "Run again",
};

export function triggerLabel(trigger: Trigger): string {
  return TRIGGER[trigger];
}

const STARTED: Record<Trigger, string> = {
  manual: "Started by hand",
  schedule: "Started by its schedule",
  event: "Started by an event",
  parent: "Started by a parent run",
  detached: "Started detached from a run",
  restart: "Run again by hand",
};

export function startedBy(trigger: Trigger): string {
  return STARTED[trigger];
}
