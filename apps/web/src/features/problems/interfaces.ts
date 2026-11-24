import type { Diagnostic } from "vscode-languageserver-protocol";

export interface QuickFix {
  readonly title: string;
  readonly apply: () => void;
}

export interface ProblemsProps {
  readonly problems: readonly Diagnostic[];
  readonly onShow: (problem: Diagnostic) => void;
  readonly fixesFor: (problem: Diagnostic) => readonly QuickFix[];
}
