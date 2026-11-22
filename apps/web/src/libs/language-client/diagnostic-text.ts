import type { Diagnostic } from "vscode-languageserver-protocol";

export function isSameDiagnostic(one: Diagnostic, other: Diagnostic): boolean {
  const start = one.range.start;
  const otherStart = other.range.start;
  return (
    diagnosticText(one) === diagnosticText(other) &&
    start.line === otherStart.line &&
    start.character === otherStart.character
  );
}

export function diagnosticText(diagnostic: Diagnostic): string {
  const message = diagnostic.message;
  return typeof message === "string" ? message : message.value;
}
