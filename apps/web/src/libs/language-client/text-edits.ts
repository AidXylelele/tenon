import { LSPPlugin } from "@codemirror/lsp-client";
import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { TextEdit } from "vscode-languageserver-protocol";

export function applyTextEdits(
  view: EditorView,
  edits: readonly TextEdit[],
  remembered = true,
): void {
  const plugin = LSPPlugin.get(view);

  if (plugin === null) return;

  const changes = edits.map((edit) => {
    const start = plugin.fromPosition(edit.range.start, plugin.syncedDoc);
    const end = plugin.fromPosition(edit.range.end, plugin.syncedDoc);
    const from = plugin.unsyncedChanges.mapPos(start);
    const to = plugin.unsyncedChanges.mapPos(end);
    return { from, to, insert: edit.newText };
  });

  const history = Transaction.addToHistory.of(remembered);
  view.dispatch({
    changes,
    userEvent: "input.language-server",
    annotations: history,
  });
}
