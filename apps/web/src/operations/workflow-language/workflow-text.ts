import type { LSPClient } from "@codemirror/lsp-client";
import {
  type FromJsonParams,
  type FromJsonResult,
  methods,
  type NewDocumentParams,
  type NewDocumentResult,
} from "language-server/protocol";

export function newDocumentText(
  client: LSPClient,
  params: NewDocumentParams,
): Promise<NewDocumentResult> {
  return client.request<NewDocumentParams, NewDocumentResult>(
    methods.newDocument,
    params,
  );
}

export function textFromJson(
  client: LSPClient,
  document: FromJsonParams["document"],
): Promise<FromJsonResult> {
  return client.request<FromJsonParams, FromJsonResult>(methods.fromJson, {
    document,
  });
}
