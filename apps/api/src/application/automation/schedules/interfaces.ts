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
