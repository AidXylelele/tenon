import type { Diagnostic as LintDiagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type Position,
} from "vscode-languageserver-protocol";
import type {
  CodeProblem,
  ProblemSeverity,
} from "@/libs/codemirror/interfaces";
import { diagnosticText } from "./diagnostic-text";

export function lintDiagnosticsOf(
  diagnostics: readonly Diagnostic[],
  doc: Text,
): readonly LintDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const from = offsetOf(diagnostic.range.start, doc);
    const to = offsetOf(diagnostic.range.end, doc);
    const severity = severityOf(diagnostic.severity);
    const message = diagnosticText(diagnostic);
    return { from, to, severity, message };
  });
}

export function codeProblemsOf(
  diagnostics: readonly Diagnostic[],
): readonly CodeProblem[] {
  return diagnostics.map((diagnostic) => {
    const line = diagnostic.range.start.line + 1;
    const message = diagnosticText(diagnostic);
    const severity = severityOf(diagnostic.severity);
    return { line, message, severity };
  });
}

function severityOf(severity: DiagnosticSeverity | undefined): ProblemSeverity {
  switch (severity) {
    case DiagnosticSeverity.Warning:
      return "warning";
    case DiagnosticSeverity.Information:
      return "info";
    case DiagnosticSeverity.Hint:
      return "hint";
    case DiagnosticSeverity.Error:
    case undefined:
      return "error";
  }
}

function offsetOf(position: Position, doc: Text): number {
  const number = position.line + 1;
  const pastTheEnd = number > doc.lines;

  if (pastTheEnd) return doc.length;

  const line = doc.line(number);
  const column = Math.min(position.character, line.length);
  return line.from + column;
}
