import {
  type CodeAction,
  CodeActionKind,
  type CodeActionParams,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { type Fix, fixesAt } from "../../ide/fixes/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspDiagnosticOf } from "../diagnostics.js";
import { ideRangeOf, textEditOf } from "../positions.js";

export function codeActionHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: CodeActionParams) => CodeAction[] | null {
  return (params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    const only = params.context.only ?? [CodeActionKind.QuickFix];
    const isAsked = only.includes(CodeActionKind.QuickFix);

    if (document === undefined || !isAsked) {
      return null;
    }

    const snapshot = host.snapshotOf(document);
    const range = ideRangeOf(params.range);
    const fixes = fixesAt(snapshot, range);
    return fixes.map((fix) => codeActionOf(uri, fix));
  };
}

function codeActionOf(uri: string, fix: Fix): CodeAction {
  const diagnostic = lspDiagnosticOf(fix.diagnostic);
  const edits = fix.changes.map(textEditOf);

  return {
    title: fix.title,
    kind: CodeActionKind.QuickFix,
    diagnostics: [diagnostic],
    edit: { changes: { [uri]: edits } },
  };
}
