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
  Started = "instance.started",
  EffectRequested = "instance.effect-requested",
  TimerSet = "instance.timer-set",
  Ended = "instance.ended",
  ChildrenAbandoned = "instance.children-abandoned",
}

export enum EffectKind {
  Call = "call",
  Process = "process",
  Detached = "detached",
  Child = "child",
  Emit = "emit",
  Timer = "timer",
  Listen = "listen",
  Receive = "receive",
}

export enum WaitEnd {
  Expired = "expired",
  Elapsed = "elapsed",
  Closed = "closed",
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
