export enum Role {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export enum AccountType {
  Password = 'password',
  Oidc = 'oidc',
}

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
}

export enum TriggerType {
  Manual = 'manual',
  Schedule = 'schedule',
  Webhook = 'webhook',
  SubWorkflow = 'sub-workflow',
  Error = 'error',
}

export enum OnError {
  Stop = 'stop',
  Continue = 'continue',
  ErrorOutput = 'errorOutput',
}

export enum GraphFaultCode {
  DuplicateNodeId = 'duplicate-node-id',
  UnknownConnectionNode = 'unknown-connection-node',
  DuplicateNodeName = 'duplicate-node-name',
  Cycle = 'cycle',
}

export enum ProblemCode {
  UnknownNodeType = 'unknown-node-type',
  InvalidParameter = 'invalid-parameter',
  InvalidRegex = 'invalid-regex',
  FormulaSyntax = 'formula-syntax',
  FormulaScope = 'formula-scope',
  UnknownPort = 'unknown-port',
  MissingCredential = 'missing-credential',
  ForeignCredential = 'foreign-credential',
  CredentialTypeMismatch = 'credential-type-mismatch',
  SecondResumeWait = 'second-resume-wait',
}

export enum ErrorKind {
  User = 'user',
  Limit = 'limit',
  Isolation = 'isolation',
  Timeout = 'timeout',
  Platform = 'platform',
  Cancelled = 'cancelled',
}

export enum RunMode {
  Test = 'test',
  Production = 'production',
}

export enum RunStatus {
  Queued = 'queued',
  Running = 'running',
  Waiting = 'waiting',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum StepStatus {
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum Arrival {
  Execute = 'execute',
  Done = 'done',
  Stop = 'stop',
}
