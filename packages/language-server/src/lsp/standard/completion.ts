import {
  type CompletionItem,
  CompletionItemKind,
  type CompletionList,
  type CompletionParams,
  MarkupKind,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  type CompletionCandidate,
  completionsAt,
  type Completions,
} from "../../ide/completion/index.js";
import type { HostReads } from "../../ide/places/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspRangeOf, positionOf } from "../positions.js";

export function completionHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  hostReads: HostReads,
): (params: CompletionParams) => CompletionList | null {
  return (params) => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) {
      return null;
    }

    const speculate = (text: string) => host.speculate(document, text);
    const reads = { ...hostReads, speculate };
    const text = document.getText();
    const position = positionOf(params.position);
    const completions = completionsAt(text, position, reads);
    return completionListOf(completions);
  };
}

function completionListOf(completions: Completions): CompletionList {
  const editRange = lspRangeOf(completions.range);
  const items = completions.items.map(completionItemOf);

  return { isIncomplete: false, itemDefaults: { editRange }, items };
}

function completionItemOf(candidate: CompletionCandidate): CompletionItem {
  const kind = itemKindOf(candidate.kind);
  const item = { label: candidate.label, kind, textEditText: candidate.insert };
  const description = candidate.description;

  if (description === null) {
    return item;
  }

  const documentation = { kind: MarkupKind.Markdown, value: description };
  return { ...item, documentation };
}

function itemKindOf(kind: CompletionCandidate["kind"]): CompletionItemKind {
  switch (kind) {
    case "member":
      return CompletionItemKind.Property;
    case "value":
      return CompletionItemKind.EnumMember;
    case "directive":
      return CompletionItemKind.Keyword;
    case "name":
      return CompletionItemKind.Reference;
    case "variable":
      return CompletionItemKind.Variable;
  }
}
