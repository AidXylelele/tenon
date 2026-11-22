import {
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { documentOf } from "../../ide/document/index.js";
import type { Snapshot } from "../../ide/snapshot/index.js";
import {
  type DocumentParams,
  type DocumentResult,
  methods,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspDiagnosticOf } from "../diagnostics.js";
import { holdsVersionedDocument, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const documentRequest = new RequestType<
  DocumentParams,
  DocumentResult,
  void
>(methods.document);

export function documentHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => DocumentResult | ResponseError {
  return (params) => {
    const isValid = holdsVersionedDocument(params);

    if (!isValid) {
      return invalidParamsOf(methods.document);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    return documentResultOf(snapshot);
  };
}

function documentResultOf(snapshot: Snapshot): DocumentResult {
  const reading = documentOf(snapshot);
  const version = snapshot.version;

  switch (reading.kind) {
    case "document":
      return { kind: "document", version, document: reading.document };
    case "refused": {
      const diagnostics = reading.diagnostics.map(lspDiagnosticOf);
      return { kind: "refused", version, diagnostics };
    }
  }
}
