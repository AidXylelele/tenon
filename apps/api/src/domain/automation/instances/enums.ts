// The standard's status phases of a workflow instance.
export enum Phase {
  Pending = 'pending',
  Running = 'running',
  Waiting = 'waiting',
  Suspended = 'suspended',
  Cancelled = 'cancelled',
  Faulted = 'faulted',
  Completed = 'completed',
}

// What started an instance.
export enum TriggerKind {
  Manual = 'manual',
  Schedule = 'schedule',
  Event = 'event',
  Parent = 'parent',
  Restart = 'restart',
}

// What the runtime does after a task: go on, wait for a resume, or stop.
export enum RunDirective {
  Continue = 'continue',
  Suspend = 'suspend',
  Stop = 'stop',
}

// Why an instance refuses a request; the presentation turns the code into a message.
export enum InstanceRefusal {
  Ended = 'instance.ended',
  NotEnded = 'instance.not-ended',
  NotRunning = 'instance.not-running',
  NotSuspended = 'instance.not-suspended',
}

export enum InstanceEventKind {
  Cancelled = 'instance.cancelled',
  Resumed = 'instance.resumed',
  Deleted = 'instance.deleted',
}
