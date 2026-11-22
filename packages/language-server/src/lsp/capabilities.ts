import {
  CodeActionKind,
  type ServerCapabilities,
  TextDocumentSyncKind,
} from "vscode-languageserver/browser";

export const serverCapabilities: ServerCapabilities = {
  textDocumentSync: {
    openClose: true,
    change: TextDocumentSyncKind.Incremental,
  },
  completionProvider: { triggerCharacters: ["$"] },
  hoverProvider: true,
  codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
  definitionProvider: true,
  referencesProvider: true,
  renameProvider: true,
};
