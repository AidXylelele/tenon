export enum WorkflowStatus {
  Active = "active",
  Archived = "archived",
}

export enum WorkflowRefusal {
  Archived = "workflow.archived",
  Unpublished = "workflow.unpublished",
  VersionTaken = "workflow.version-taken",
  Off = "workflow.off",
  ChainRunning = "workflow.chain-running",
  OwnLifecycle = "workflow.own-lifecycle",
}

export enum WorkflowEventKind {
  ScheduleArmed = "workflow.schedule-armed",
  ScheduleFired = "workflow.schedule-fired",
}

export enum ScheduleKind {
  Every = "every",
  Cron = "cron",
  After = "after",
  On = "on",
}
