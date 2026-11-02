export enum TaskStage {
  Entry = 'entry',
  Body = 'body',
  Output = 'output',
  Export = 'export',
  ExportCheck = 'export-check',
  Ended = 'ended',
}

export enum ProgressKind {
  Definition = 'definition',
  Calling = 'calling',
  Running = 'running',
  Function = 'function',
  SubWorkflow = 'sub-workflow',
  Do = 'do',
  For = 'for',
  Fork = 'fork',
  Switch = 'switch',
  Try = 'try',
  Catch = 'catch',
  Retry = 'retry',
  Handler = 'handler',
}

export enum EndingKind {
  Completed = 'completed',
  Faulted = 'faulted',
  Skipped = 'skipped',
}

export enum OriginKind {
  User = 'user',
  Parent = 'parent',
}
