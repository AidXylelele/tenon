import {
  LSPErrorCodes,
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { templateAtOf } from "../../ide/templates/index.js";
import {
  methods,
  type ReadTemplateParams,
  type ReadTemplateResult,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { holdsReadTemplateParams, invalidParamsOf } from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const readTemplateRequest = new RequestType<
  ReadTemplateParams,
  ReadTemplateResult,
  void
>(methods.readTemplate);

export function readTemplateHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: unknown) => ReadTemplateResult | ResponseError {
  return (params) => {
    const isValid = holdsReadTemplateParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.readTemplate);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const lookup = templateAtOf(snapshot, params.pointer);

    switch (lookup.kind) {
      case "template":
      case "expression":
        return lookup;
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, lookup.reason);
    }
  };
}
