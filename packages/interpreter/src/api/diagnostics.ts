export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly pointer: string;
  readonly range: Range | null;
  readonly subject: string | null;
  readonly import: Import | null;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export interface Position {
  readonly line: number;
  readonly column: number;
}

export type DiagnosticCode =
  | "syntax"
  | "schema"
  | "dsl-version"
  | "expression-language"
  | "expression"
  | "unknown-variable"
  | "duplicate-task"
  | "unknown-task"
  | "branch-jump"
  | "duplicate-default"
  | "undeclared-component"
  | "undeclared-secret"
  | "unknown-secret"
  | "duration"
  | "cron"
  | "regex"
  | "json-schema"
  | "unresolved-import"
  | "invalid-import"
  | "recursive-function"
  | "capability"
  | "event-attribute";

export interface Import {
  readonly reference: string;
  readonly uri: string | null;
}
