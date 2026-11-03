// The record of a task's execution, as the progress view shows it (FR-015): a skipped task
// (its `if` was false) entered no phase; a task still running when its instance ended is
// cancelled with it.
export enum TaskStatus {
  Running = 'running',
  Completed = 'completed',
  Faulted = 'faulted',
  Cancelled = 'cancelled',
  Skipped = 'skipped',
}
