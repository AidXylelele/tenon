import {
  LSPErrorCodes,
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { dataAtOf } from "../../ide/data/index.js";
import {
  type DataAtParams,
  type DataAtResult,
  methods,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { holdsDataAtParams, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const dataAtRequest = new RequestType<DataAtParams, DataAtResult, void>(
  methods.dataAt,
);

export function dataAtHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => DataAtResult | ResponseError {
  return (params) => {
    const isValid = holdsDataAtParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.dataAt);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const document = documents.get(identifier.uri);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    if (document === undefined) {
      const message = `The document ${identifier.uri} is not open.`;
      return new ResponseError(LSPErrorCodes.RequestFailed, message);
    }

    const speculate = (text: string) => host.speculate(document, text);
    const written = params.samples ?? {};
    const sampled = Object.entries(written);
    const samples = new Map(sampled);
    const typed = params.typed ?? null;
    const request = { step: params.step, field: params.field, samples, typed };
    const reading = dataAtOf(snapshot, request, speculate);

    switch (reading.kind) {
      case "data": {
        const { entries, warnings } = reading;
        return { version: snapshot.version, entries, warnings };
      }
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, reading.reason);
    }
  };
}
