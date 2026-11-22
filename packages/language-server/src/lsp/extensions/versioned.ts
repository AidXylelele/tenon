import {
  LSPErrorCodes,
  ResponseError,
  type TextDocuments,
  type VersionedTextDocumentIdentifier,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Snapshot } from "../../ide/snapshot/index.js";
import type { AnalysisHost } from "../analysis-host.js";

export function versionedSnapshotOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  identifier: VersionedTextDocumentIdentifier,
): Snapshot | ResponseError {
  const document = documents.get(identifier.uri);
  const isOpen = document !== undefined;

  if (!isOpen) {
    const message = `The document ${identifier.uri} is not open.`;
    return new ResponseError(LSPErrorCodes.RequestFailed, message);
  }

  const isCurrent = document.version === identifier.version;

  if (!isCurrent) {
    const named = String(identifier.version);
    const current = String(document.version);
    const message = `The request names version ${named}; the document is at version ${current}.`;
    return new ResponseError(LSPErrorCodes.ContentModified, message);
  }

  return host.snapshotOf(document);
}
