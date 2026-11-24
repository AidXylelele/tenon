import {
  CodeActionKind,
  type ServerCapabilities,
  TextDocumentSyncKind,
} from "vscode-languageserver/browser";
import { methods } from "../protocol/index.js";

const customMethods = Object.values(methods);

const experimental = Object.fromEntries(
  customMethods.map((method) => [method, true] as const),
);

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
  experimental,
};
