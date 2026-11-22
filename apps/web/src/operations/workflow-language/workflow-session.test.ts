import type { LSPClient } from "@codemirror/lsp-client";
import { type EditAction, methods } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { WorkflowSession } from "./workflow-session";

type Question = (session: WorkflowSession) => Promise<unknown>;

const URI = "file:///sales/leads.yaml";
const REMOVE: EditAction = { kind: "removeStep", step: "fetch" };
const textDocument = { uri: URI, version: 7 };

function clientOf(version: number | null) {
  const file = version === null ? null : { version };
  const getFile = vi.fn(() => file);
  const sync = vi.fn();
  const request = vi.fn(() => Promise.resolve("answered"));
  const workspace = { getFile };
  const client = { sync, request, workspace } as unknown as LSPClient;
  return { client, sync, request };
}

describe("a session asking the language server about one open document", () => {
  it.each<[string, Question, string, object]>([
    [
      "structure",
      (session) => session.structure(),
      methods.structure,
      { textDocument },
    ],
    [
      "step_form",
      (session) => session.stepForm("fetch"),
      methods.stepForm,
      { textDocument, step: "fetch" },
    ],
    [
      "workflow_form",
      (session) => session.workflowForm(),
      methods.workflowForm,
      { textDocument },
    ],
    [
      "edit",
      (session) => session.edit(REMOVE),
      methods.edit,
      { textDocument, action: REMOVE },
    ],
    [
      "document",
      (session) => session.document(),
      methods.document,
      { textDocument },
    ],
    [
      "ranges",
      (session) => session.rangesOf(["/do/0"]),
      methods.rangesOf,
      { textDocument, pointers: ["/do/0"] },
    ],
  ])(
    "the_%s_question_names_the_open_version_of_the_document",
    async (_, ask, method, params) => {
      const { client, request } = clientOf(7);
      const session = new WorkflowSession(client, URI);

      const answer = await ask(session);

      expect(answer).toBe("answered");
      expect(request).toHaveBeenCalledWith(method, params);
    },
  );

  it("the_text_is_synced_before_the_server_is_asked", async () => {
    const { client, sync, request } = clientOf(7);
    const session = new WorkflowSession(client, URI);

    await session.structure();

    const [synced = Infinity] = sync.mock.invocationCallOrder;
    const [asked = -Infinity] = request.mock.invocationCallOrder;
    expect(synced).toBeLessThan(asked);
  });

  it("a_document_that_is_not_open_is_not_asked_about", async () => {
    const { client, request } = clientOf(null);
    const session = new WorkflowSession(client, URI);

    const answer = session.document();

    await expect(answer).rejects.toThrow(new Error(`${URI} is not open`));
    expect(request).not.toHaveBeenCalled();
  });
});
