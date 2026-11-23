export enum TaskStatus {
  Running = "running",
  Completed = "completed",
  Faulted = "faulted",
  Cancelled = "cancelled",
  Skipped = "skipped",
}

export enum InstanceOrder {
  Started = "started",
  Duration = "duration",
}

export enum EffectResult {
  Started = "started",
  Missing = "missing",
  Emitted = "emitted",
}
