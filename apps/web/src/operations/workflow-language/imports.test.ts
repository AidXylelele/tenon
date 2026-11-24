import type { LSPClient } from "@codemirror/lsp-client";
import { methods } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import type { Outcome } from "@/libs/data-access/problem";
import { fetchingImports } from "./imports";

const LOG = "https://example.com/functions/log.yaml";
const SMS = "https://example.com/functions/sms.yaml";

const rejected: Outcome<string> = {
  ok: false,
  problem: {
    type: "urn:problem:import.rejected",
    title: "Rejected",
    status: 502,
    detail: "The host answered 404.",
    errors: [],
    retryAfter: null,
  },
};

describe("the imports the language server asks for", () => {
  it("each_text_and_each_failure_go_back_under_their_reference", async () => {
    const fetchImport = (uri: string): Promise<Outcome<string>> => {
      if (uri === LOG) return Promise.resolve({ ok: true, value: "set: {}" });

      if (uri === SMS) return Promise.reject(new Error("The action is gone."));

      return Promise.resolve(rejected);
    };
    const notification = vi.fn();
    const client = { notification } as unknown as LSPClient;
    const handlers = fetchingImports(fetchImport);
    const handle = handlers[methods.importsNeeded];
    const textDocument = { uri: "file:///sales/leads.yaml" };
    const imports = [
      { reference: "log", uri: LOG },
      { reference: "mail", uri: "https://example.com/functions/mail.yaml" },
      { reference: "sms", uri: SMS },
    ];

    handle?.(client, { textDocument, imports });
    await vi.waitFor(() => {
      expect(notification).toHaveBeenCalledOnce();
    });

    expect(notification).toHaveBeenCalledWith(methods.didFetchImports, {
      textDocument,
      texts: { log: "set: {}" },
      failures: {
        mail: "The host answered 404.",
        sms: "The action is gone.",
      },
    });
  });
});
