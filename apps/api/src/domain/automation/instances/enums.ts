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
  Detached = 'detached',
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

// The changes of an instance that leave its transaction: the engine running it learns of a
// cancel, a resume or a delete, and every change but a delete is the standard's lifecycle event.
export enum InstanceEventKind {
  Started = 'instance.started',
  Suspended = 'instance.suspended',
  Resumed = 'instance.resumed',
  Cancelled = 'instance.cancelled',
  Faulted = 'instance.faulted',
  Completed = 'instance.completed',
  Deleted = 'instance.deleted',
}
