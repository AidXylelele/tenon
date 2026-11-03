export enum VerdictKind {
  Valid = 'valid',
  Invalid = 'invalid',
}

export enum RunOutcomeKind {
  Completed = 'completed',
  Faulted = 'faulted',
  Stopped = 'stopped',
}

// How a schedule's occurrences come: on a cron, at an interval, or after the previous ends.
export enum TimingKind {
  Cron = 'cron',
  Every = 'every',
  After = 'after',
}
