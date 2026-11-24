import {
  LSPErrorCodes,
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { editsOf } from "../../ide/edits/index.js";
import {
  type EditParams,
  type EditResult,
  methods,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { textEditOf } from "../positions.js";
import { holdsEditParams, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const editRequest = new RequestType<EditParams, EditResult, void>(
  methods.edit,
);

export function editHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => EditResult | ResponseError {
  return (params) => {
    const isValid = holdsEditParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.edit);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const editing = editsOf(snapshot, params.action);

    switch (editing.kind) {
      case "edited": {
        const edits = editing.changes.map(textEditOf);
        return { edits, ids: editing.ids };
      }
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, editing.reason);
    }
  };
}
