export enum Phase {
  Pending = "pending",
  Running = "running",
  Waiting = "waiting",
  Suspended = "suspended",
  Cancelled = "cancelled",
  Faulted = "faulted",
  Completed = "completed",
}

export enum TriggerKind {
  Manual = "manual",
  Schedule = "schedule",
  Event = "event",
  Parent = "parent",
  Detached = "detached",
  Restart = "restart",
}

export enum TurnStatus {
  Running = "running",
  Suspended = "suspended",
  Completed = "completed",
  Faulted = "faulted",
  Cancelled = "cancelled",
  Stranded = "stranded",
}

export enum CancelReason {
  InterpreterChanged = "the platform's interpreter changed",
}

export enum Control {
  Suspend = "suspend",
  Resume = "resume",
  Cancel = "cancel",
  Restart = "restart",
  Delete = "delete",
}

export enum InstanceRefusal {
  Ended = "instance.ended",
  NotEnded = "instance.not-ended",
  NotRunning = "instance.not-running",
  NotSuspended = "instance.not-suspended",
  NotReceiving = "instance.not-receiving",
}

export enum InstanceEventKind {
  Ended = "instance.ended",
  ChildrenAbandoned = "instance.children-abandoned",
  Deleted = "instance.deleted",
}

export enum WaitKind {
  Timer = "timer",
  Event = "event",
  Child = "child",
  Message = "message",
}

export enum TaskValueKind {
  Input = "input",
  Output = "output",
}

export enum InboundKind {
  Message = "message",
  Failure = "failure",
}
