export enum JqOutcomeKind {
  Compiled = 'compiled',
  Evaluated = 'evaluated',
  Failure = 'failure',
  TimedOut = 'timed-out',
  Aborted = 'aborted',
}

export enum JsonSchemaOutcomeKind {
  Compiled = 'compiled',
  Valid = 'valid',
  Invalid = 'invalid',
  Unusable = 'unusable',
  TimedOut = 'timed-out',
}

export enum AuthorizationKind {
  Header = 'header',
  ClientCredentials = 'client-credentials',
}

export enum EndpointOutcomeKind {
  Responded = 'responded',
  Read = 'read',
  Unreadable = 'unreadable',
  Rejected = 'rejected',
  TimedOut = 'timed-out',
  Unreachable = 'unreachable',
  Unauthorized = 'unauthorized',
  Invalid = 'invalid',
}

export enum RequestPreparationKind {
  Prepared = 'prepared',
  Misconfigured = 'misconfigured',
}

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

// The task kinds of DSL 1.0.3, each named by the property that declares it.
export enum TaskKind {
  Call = 'call',
  Do = 'do',
  Emit = 'emit',
  For = 'for',
  Fork = 'fork',
  Listen = 'listen',
  Raise = 'raise',
  Run = 'run',
  Set = 'set',
  Switch = 'switch',
  Try = 'try',
  Wait = 'wait',
}
