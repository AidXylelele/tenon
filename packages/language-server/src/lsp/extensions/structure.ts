import {
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { structureReadingOf } from "../../ide/structure/index.js";
import type * as protocol from "../../protocol/index.js";
import { methods } from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspWorkflowOf } from "../positions.js";
import { holdsVersionedDocument, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const structureRequest = new RequestType<
  protocol.StructureParams,
  protocol.StructureResult,
  void
>(methods.structure);

export function structureHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => protocol.StructureResult | ResponseError {
  return (params) => {
    const isValid = holdsVersionedDocument(params);

    if (!isValid) {
      return invalidParamsOf(methods.structure);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const reading = structureReadingOf(snapshot);
    const workflow = lspWorkflowOf(reading.workflow);
    const stale = reading.stale;
    return { version: snapshot.version, stale, workflow };
  };
}
