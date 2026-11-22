import type { Diagnostic } from "@codemirror/lint";

export type ScriptLanguage = "javascript" | "python";

export type ProblemSeverity = Diagnostic["severity"];

export interface CodeProblem {
  readonly line: number;
  readonly message: string;
  readonly severity: ProblemSeverity;
}
