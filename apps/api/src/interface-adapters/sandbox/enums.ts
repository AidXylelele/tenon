export enum GoJudgeStatus {
  Accepted = 'Accepted',
  NonzeroExitStatus = 'Nonzero Exit Status',
  TimeLimitExceeded = 'Time Limit Exceeded',
}

export enum SandboxOutcomeKind {
  Ran = 'ran',
  Rejected = 'rejected',
  TimedOut = 'timed-out',
  Unreachable = 'unreachable',
  Refused = 'refused',
}
