import { history, undo } from "@codemirror/commands";
import { LSPClient } from "@codemirror/lsp-client";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { TextEdit } from "vscode-languageserver-protocol";
import { scriptedServer } from "./language-server.test-support";
import { applyTextEdits } from "./text-edits";

const URI = "file:///daily-digest.yaml";

const DOC = "do:\n  - fetch:\n      call: http\n";

const USE_GRPC: TextEdit = {
  range: { start: { line: 2, character: 12 }, end: { line: 2, character: 16 } },
  newText: "grpc",
};

const INITIALIZED = new Map([["initialize", { capabilities: {} }]]);

const views: EditorView[] = [];

async function editorOnServer(): Promise<EditorView> {
  const server = scriptedServer(INITIALIZED);
  const client = new LSPClient().connect(server.transport);
  await client.initializing;
  const plugin = client.plugin(URI);
  const remembered = history();
  const view = new EditorView({ doc: DOC, extensions: [plugin, remembered] });
  views.push(view);
  return view;
}

describe("edits a language server sends", () => {
  afterEach(() => {
    for (const view of views) view.destroy();
    views.length = 0;
  });

  it("an_edit_changes_the_text_at_its_range", async () => {
    const view = await editorOnServer();

    applyTextEdits(view, [USE_GRPC]);

    const text = view.state.doc.toString();
    expect(text).toBe("do:\n  - fetch:\n      call: grpc\n");
  });

  it("an_edit_lands_where_the_server_meant_after_typing_it_has_not_seen", async () => {
    const view = await editorOnServer();
    view.dispatch({ changes: { from: 0, insert: "# digest\n" } });

    applyTextEdits(view, [USE_GRPC]);

    const text = view.state.doc.toString();
    expect(text).toBe("# digest\ndo:\n  - fetch:\n      call: grpc\n");
  });

  it("an_edit_kept_out_of_history_is_not_undone", async () => {
    const view = await editorOnServer();
    applyTextEdits(view, [USE_GRPC], false);

    undo(view);

    const text = view.state.doc.toString();
    expect(text).toBe("do:\n  - fetch:\n      call: grpc\n");
  });

  it("an_editor_not_on_the_server_is_left_as_it_is", () => {
    const view = new EditorView({ doc: DOC });
    views.push(view);

    applyTextEdits(view, [USE_GRPC]);

    const text = view.state.doc.toString();
    expect(text).toBe(DOC);
  });
});
