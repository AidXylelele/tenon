import type { Range } from "interpreter/front-end";
import { DiagnosticSeverity } from "vscode-languageserver/browser";
import type * as lsp from "vscode-languageserver/browser";
import { titleOf } from "../ide/forms/index.js";
import { lastTokenOf } from "../ide/pointers/index.js";
import { isWarning, type Problem } from "../ide/snapshot/index.js";
import { lspRangeOf } from "./positions.js";

const index = /^\d+$/;

export function lspDiagnosticOf(diagnostic: Problem): lsp.Diagnostic {
  const range = placedRangeOf(diagnostic.range);
  const pointer = diagnostic.pointer;
  const field = fieldOf(pointer);

  return {
    range,
    severity: severityOf(diagnostic),
    code: diagnostic.code,
    source: "workflow",
    message: diagnostic.message,
    data: { pointer, field },
  };
}

function fieldOf(pointer: string): string | null {
  const member = lastTokenOf(pointer);
  const isMember = member !== "" && !index.test(member);

  if (!isMember) {
    return null;
  }

  return titleOf(member);
}

function placedRangeOf(range: Range | null): lsp.Range {
  if (range === null) {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }

  return lspRangeOf(range);
}

function severityOf(diagnostic: Problem): DiagnosticSeverity {
  if (isWarning(diagnostic)) {
    return DiagnosticSeverity.Warning;
  }

  return DiagnosticSeverity.Error;
}
