import { LSPClient } from "@codemirror/lsp-client";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CodeAction,
  Command,
  Diagnostic,
  TextEdit,
} from "vscode-languageserver-protocol";
import {
  applyCodeAction,
  codeActionsFor,
  offersCodeActions,
} from "./code-actions";
import { scriptedServer } from "./language-server.test-support";

const URI = "file:///daily-digest.yaml";

const DOC = "do:\n  - fetch:\n      call: http\n";

const FIXED = "do:\n  - fetch:\n      call: grpc\n";

const USE_GRPC: TextEdit = {
  range: { start: { line: 2, character: 12 }, end: { line: 2, character: 16 } },
  newText: "grpc",
};

const UNKNOWN_CALL: Diagnostic = {
  range: { start: { line: 2, character: 12 }, end: { line: 2, character: 16 } },
  message: "Unknown call",
};

const views: EditorView[] = [];

async function connectedTo(answers: ReadonlyMap<string, unknown>) {
  const server = scriptedServer(answers);
  const client = new LSPClient().connect(server.transport);
  await client.initializing;
  return { client, server };
}

function editorOf(client: LSPClient): EditorView {
  const plugin = client.plugin(URI);
  const view = new EditorView({ doc: DOC, extensions: plugin });
  views.push(view);
  return view;
}

function initialized(provider: unknown): ReadonlyMap<string, unknown> {
  const capabilities = { codeActionProvider: provider };
  return new Map([["initialize", { capabilities }]]);
}

describe("quick fixes asked of the language server", () => {
  afterEach(() => {
    for (const view of views) view.destroy();
    views.length = 0;
  });

  it.each<[string, unknown, boolean]>([
    ["true", true, true],
    ["a_resolving_provider", { resolveProvider: true }, true],
    ["false", false, false],
    ["nothing", undefined, false],
  ])(
    "a_server_announcing_%s_offers_code_actions_%s",
    async (_, provider, expected) => {
      const answers = initialized(provider);
      const { client } = await connectedTo(answers);

      const offered = offersCodeActions(client);

      expect(offered).toBe(expected);
    },
  );

  it("the_quick_fixes_are_asked_for_the_lines_the_diagnostics_cover", async () => {
    const answers = initialized(true);
    const { client, server } = await connectedTo(answers);

    await codeActionsFor(client, URI, [UNKNOWN_CALL]);

    expect(server.received).toContainEqual({
      method: "textDocument/codeAction",
      params: {
        textDocument: { uri: URI },
        range: {
          start: { line: 0, character: 0 },
          end: { line: 3, character: 0 },
        },
        context: { diagnostics: [UNKNOWN_CALL], only: ["quickfix"] },
      },
    });
  });

  it("commands_among_the_answers_are_left_out", async () => {
    const fix: CodeAction = {
      title: "Call gRPC",
      kind: "quickfix",
      edit: { changes: { [URI]: [USE_GRPC] } },
    };
    const open: Command = { title: "Open the docs", command: "docs.open" };
    const answers = new Map<string, unknown>([
      ["initialize", { capabilities: { codeActionProvider: true } }],
      ["textDocument/codeAction", [fix, open]],
    ]);
    const { client } = await connectedTo(answers);

    const actions = await codeActionsFor(client, URI, [UNKNOWN_CALL]);

    expect(actions).toEqual([fix]);
  });

  it("no_answer_is_no_quick_fix", async () => {
    const answers = initialized(true);
    const { client } = await connectedTo(answers);

    const actions = await codeActionsFor(client, URI, [UNKNOWN_CALL]);

    expect(actions).toEqual([]);
  });

  it("a_fix_applies_its_changes_to_the_document", async () => {
    const answers = initialized(true);
    const { client } = await connectedTo(answers);
    const view = editorOf(client);
    const fix: CodeAction = {
      title: "Call gRPC",
      edit: { changes: { [URI]: [USE_GRPC] } },
    };

    await applyCodeAction(client, view, URI, fix);

    const text = view.state.doc.toString();
    expect(text).toBe(FIXED);
  });

  it("a_fix_applies_only_the_document_changes_of_this_document", async () => {
    const answers = initialized(true);
    const { client } = await connectedTo(answers);
    const view = editorOf(client);
    const elsewhere: TextEdit = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 2 },
      },
      newText: "done",
    };
    const fix: CodeAction = {
      title: "Call gRPC",
      edit: {
        documentChanges: [
          { textDocument: { uri: URI, version: null }, edits: [USE_GRPC] },
          {
            textDocument: { uri: "file:///other.yaml", version: null },
            edits: [elsewhere],
          },
        ],
      },
    };

    await applyCodeAction(client, view, URI, fix);

    const text = view.state.doc.toString();
    expect(text).toBe(FIXED);
  });

  it("a_fix_without_its_edit_is_resolved_first_where_the_server_resolves", async () => {
    const resolved: CodeAction = {
      title: "Call gRPC",
      edit: { changes: { [URI]: [USE_GRPC] } },
    };
    const answers = new Map<string, unknown>([
      [
        "initialize",
        { capabilities: { codeActionProvider: { resolveProvider: true } } },
      ],
      ["codeAction/resolve", resolved],
    ]);
    const { client } = await connectedTo(answers);
    const view = editorOf(client);
    const unresolved: CodeAction = { title: "Call gRPC" };

    await applyCodeAction(client, view, URI, unresolved);

    const text = view.state.doc.toString();
    expect(text).toBe(FIXED);
  });

  it("a_fix_without_an_edit_from_a_server_that_does_not_resolve_changes_nothing", async () => {
    const answers = initialized(true);
    const { client } = await connectedTo(answers);
    const view = editorOf(client);
    const bare: CodeAction = { title: "Call gRPC" };

    await applyCodeAction(client, view, URI, bare);

    const text = view.state.doc.toString();
    expect(text).toBe(DOC);
  });
});
