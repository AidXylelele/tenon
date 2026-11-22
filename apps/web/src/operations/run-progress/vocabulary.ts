import type { Phase, TaskStatus, Trigger } from "@/libs/data-access/types";

const PHASE: Record<Phase, string> = {
  pending: "Pending",
  running: "Running",
  waiting: "Waiting",
  suspended: "Suspended",
  completed: "Completed",
  faulted: "Faulted",
  cancelled: "Cancelled",
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

const TASK_STATUS: Record<TaskStatus, string> = {
  running: "Running",
  completed: "Completed",
  faulted: "Faulted",
  cancelled: "Cancelled",
  skipped: "Skipped",
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS[status];
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
