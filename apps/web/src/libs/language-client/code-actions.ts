import type { LSPClient } from "@codemirror/lsp-client";
import type { EditorView } from "@codemirror/view";
import type {
  CodeAction,
  CodeActionParams,
  Command,
  Diagnostic,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver-protocol";
import { applyTextEdits } from "./text-edits";

export function offersCodeActions(client: LSPClient): boolean {
  const provider = client.serverCapabilities?.codeActionProvider;
  return provider !== undefined && provider !== false;
}

export async function codeActionsFor(
  client: LSPClient,
  uri: string,
  diagnostics: readonly Diagnostic[],
): Promise<CodeAction[]> {
  client.sync();
  const lines = diagnostics.map((diagnostic) => diagnostic.range.end.line);
  const end = { line: Math.max(0, ...lines) + 1, character: 0 };
  const range = { start: { line: 0, character: 0 }, end };
  const params: CodeActionParams = {
    textDocument: { uri },
    range,
    context: { diagnostics: [...diagnostics], only: ["quickfix"] },
  };
  const answered = await client.request<
    CodeActionParams,
    (CodeAction | Command)[] | null
  >("textDocument/codeAction", params);
  const actions = answered ?? [];
  return actions.filter(isCodeAction);
}

export async function applyCodeAction(
  client: LSPClient,
  view: EditorView,
  uri: string,
  action: CodeAction,
): Promise<void> {
  const resolvable = resolvesCodeActions(client) && action.edit === undefined;
  const resolved = resolvable
    ? await client.request<CodeAction, CodeAction>("codeAction/resolve", action)
    : action;
  const edits = editsFor(resolved.edit, uri);
  applyTextEdits(view, edits);
}

function resolvesCodeActions(client: LSPClient): boolean {
  const provider = client.serverCapabilities?.codeActionProvider;
  return typeof provider === "object" && provider.resolveProvider === true;
}

function editsFor(edit: WorkspaceEdit | undefined, uri: string): TextEdit[] {
  if (edit === undefined) return [];

  const changes = edit.changes?.[uri] ?? [];
  const documents = edit.documentChanges ?? [];
  const documentEdits = documents.flatMap((change) =>
    "textDocument" in change && change.textDocument.uri === uri
      ? change.edits.filter(isTextEdit)
      : [],
  );
  return [...changes, ...documentEdits];
}

function isCodeAction(action: CodeAction | Command): action is CodeAction {
  return typeof action.command !== "string";
}

function isTextEdit(edit: TextEdit | object): edit is TextEdit {
  return "newText" in edit && "range" in edit;
}
