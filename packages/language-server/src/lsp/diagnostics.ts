import type { Range } from "interpreter/front-end";
import { DiagnosticSeverity } from "vscode-languageserver/browser";
import type * as lsp from "vscode-languageserver/browser";
import type { Problem } from "../ide/snapshot/index.js";
import { lspRangeOf } from "./positions.js";

export function lspDiagnosticOf(diagnostic: Problem): lsp.Diagnostic {
  const range = placedRangeOf(diagnostic.range);

  return {
    range,
    severity: severityOf(diagnostic),
    code: diagnostic.code,
    source: "workflow",
    message: diagnostic.message,
  };
}

function placedRangeOf(range: Range | null): lsp.Range {
  if (range === null) {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  }

  return lspRangeOf(range);
}

function severityOf(diagnostic: Problem): DiagnosticSeverity {
  if (diagnostic.code === "written-reference") {
    return DiagnosticSeverity.Warning;
  }

  return DiagnosticSeverity.Error;
}
