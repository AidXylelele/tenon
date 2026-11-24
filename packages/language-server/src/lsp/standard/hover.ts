import {
  type Hover,
  type HoverParams,
  MarkupKind,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { hoverAt } from "../../ide/hover/index.js";
import type { SchemasAt } from "../../ide/places/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspRangeOf, positionOf } from "../positions.js";

export function hoverHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  schemasAt: SchemasAt,
): (params: HoverParams) => Hover | null {
  return (params) => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) {
      return null;
    }

    const snapshot = host.snapshotOf(document);
    const position = positionOf(params.position);
    const hover = hoverAt(snapshot, position, schemasAt);

    if (hover === null) {
      return null;
    }

    const contents = { kind: MarkupKind.Markdown, value: hover.markdown };
    const range = lspRangeOf(hover.range);
    return { contents, range };
  };
}
