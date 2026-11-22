export enum WorkflowStatus {
  Active = "active",
  Archived = "archived",
}

export enum WorkflowRefusal {
  Archived = "workflow.archived",
  VersionTaken = "workflow.version-taken",
  Off = "workflow.off",
  ChainRunning = "workflow.chain-running",
  OwnLifecycle = "workflow.own-lifecycle",
}

export enum WorkflowEventKind {
  ScheduleChanged = "workflow.schedule-changed",
}

export enum ScheduleKind {
  Every = "every",
  Cron = "cron",
  After = "after",
  On = "on",
}
