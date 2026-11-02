export enum GoJudgeStatus {
  Accepted = 'Accepted',
  NonzeroExitStatus = 'Nonzero Exit Status',
  TimeLimitExceeded = 'Time Limit Exceeded',
}

// The files go-judge collects from a process, each capped at `SandboxLimits.outputBytes`.
export enum GoJudgeOutput {
  Stdout = 'stdout',
  Stderr = 'stderr',
}

export enum SandboxOutcomeKind {
  Ran = 'ran',
  Rejected = 'rejected',
  TimedOut = 'timed-out',
  Unreachable = 'unreachable',
  Unrecognized = 'unrecognized',
  Oversized = 'oversized',
  Failed = 'failed',
}
