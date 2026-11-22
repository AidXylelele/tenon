import type { LSPClient } from "@codemirror/lsp-client";
import { methods } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { newDocumentText, textFromJson } from "./workflow-text";

function clientAnswering(text: string) {
  const request = vi.fn(() => Promise.resolve({ text }));
  const client = { request } as unknown as LSPClient;
  return { client, request };
}

describe("workflow texts written by the language server", () => {
  it("a_new_document_is_asked_for_with_its_address", async () => {
    const { client, request } = clientAnswering("document: {}");
    const params = { namespace: "sales", name: "leads", version: "1.0.0" };

    const written = await newDocumentText(client, params);

    expect(written).toEqual({ text: "document: {}" });
    expect(request).toHaveBeenCalledWith(methods.newDocument, params);
  });

  it("a_document_given_as_json_is_asked_to_be_written_as_text", async () => {
    const { client, request } = clientAnswering("do: []");
    const document = { do: [] };

    const written = await textFromJson(client, document);

    expect(written).toEqual({ text: "do: []" });
    expect(request).toHaveBeenCalledWith(methods.fromJson, { document });
  });
});
