export enum TaskStage {
  Entry = 'entry',
  Body = 'body',
  Output = 'output',
  Export = 'export',
  ExportCheck = 'export-check',
  Ended = 'ended',
}

export enum ProgressKind {
  Value = 'value',
  Call = 'call',
  Process = 'process',
  FunctionCall = 'function-call',
  RunWorkflow = 'run-workflow',
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
