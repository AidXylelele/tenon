// The record of a task's execution, as the progress view shows it (FR-015): a skipped task
// (its `if` was false) entered no phase.
export enum TaskStatus {
  Running = 'running',
  Completed = 'completed',
  Faulted = 'faulted',
  Skipped = 'skipped',
}
