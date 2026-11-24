import {
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { rangesOf } from "../../ide/document/index.js";
import {
  methods,
  type RangesOfParams,
  type RangesOfResult,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspPlacementOf } from "../positions.js";
import { holdsRangesOfParams, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const rangesOfRequest = new RequestType<
  RangesOfParams,
  RangesOfResult,
  void
>(methods.rangesOf);

export function rangesOfHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => RangesOfResult | ResponseError {
  return (params) => {
    const isValid = holdsRangesOfParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.rangesOf);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const placed = rangesOf(snapshot, params.pointers);
    const ranges = placed.map(lspPlacementOf);
    return { version: snapshot.version, ranges };
  };
}
