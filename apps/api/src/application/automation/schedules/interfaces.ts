import type { ScheduleSpec } from "../../../domain/automation/workflows/interfaces.js";
import type { LastRun } from "../workflows/interfaces.js";

export interface FireScheduleCommand {
  readonly workflowId: string;
  readonly arming: number;
  readonly at: number;
}

export interface StartScheduledCommand {
  readonly workflowId: string;
  readonly instanceId: string;
}

export interface ScheduledWorkflow {
  readonly workflowId: string;
  readonly schedule: ScheduleSpec;
  readonly since: Date;
}

export interface TriggerCommand {
  readonly workflowId: string;
  readonly sequence: number;
  readonly signal: AbortSignal;
}

export interface StartSlot {
  readonly workflowId: string;
  readonly from: Date;
  readonly to: Date;
}

export interface ScheduledStarts {
  readonly workflowId: string;
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly lastRun: LastRun | null;
  readonly schedule: ScheduleSpec | null;
  readonly starts: number;
}

export interface ExpectedStarts {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly lastRun: LastRun | null;
  readonly schedule: ScheduleSpec | null;
  readonly next: readonly Date[];
  readonly missed: number;
  readonly missedSince: Date;
}
