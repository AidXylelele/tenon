import { Transaction } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";

export function takeOwnersText(view: EditorView, text: string): void {
  const shown = view.state.doc.toString();

  if (shown === text) return;

  const length = view.state.doc.length;
  const fromOwner = Transaction.remote.of(true);
  const outsideHistory = Transaction.addToHistory.of(false);
  view.dispatch({
    changes: { from: 0, to: length, insert: text },
    annotations: [fromOwner, outsideHistory],
  });
}

export function isChangedHere(update: ViewUpdate): boolean {
  return update.transactions.some(isLocalChange);
}

function isLocalChange(transaction: Transaction): boolean {
  const fromOwner = transaction.annotation(Transaction.remote) === true;
  return transaction.docChanged && !fromOwner;
}
