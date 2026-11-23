import type { Schedule } from "../../../domain/automation/workflows/interfaces.js";

export interface SyncScheduleCommand {
  readonly workflowId: string;
}

export interface StartScheduledCommand {
  readonly workflowId: string;
  readonly instanceId: string;
  readonly chained: boolean;
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
  readonly schedule: Schedule | null;
  readonly starts: number;
}

export interface ExpectedStarts {
  readonly namespace: string;
  readonly name: string;
  readonly schedule: Schedule | null;
  readonly next: readonly Date[];
  readonly missed: number;
  readonly missedSince: Date;
}
