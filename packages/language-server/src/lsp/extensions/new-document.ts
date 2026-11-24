import { RequestType, type ResponseError } from "vscode-languageserver/browser";
import { newDocumentOf } from "../../ide/document/index.js";
import {
  methods,
  type NewDocumentParams,
  type NewDocumentResult,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { holdsNewDocumentParams, invalidParamsOf } from "../shapes.js";

export const newDocumentRequest = new RequestType<
  NewDocumentParams,
  NewDocumentResult,
  void
>(methods.newDocument);

export function newDocumentHandlerOf(
  host: AnalysisHost,
): (params: unknown) => NewDocumentResult | ResponseError {
  return (params) => {
    const isValid = holdsNewDocumentParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.newDocument);
    }

    const header = {
      namespace: params.namespace,
      name: params.name,
      version: params.version,
    };
    const analyze = (text: string) => host.analyzeAlone(text);
    return newDocumentOf(header, analyze);
  };
}
