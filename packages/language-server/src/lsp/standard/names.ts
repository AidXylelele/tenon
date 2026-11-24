import {
  type DefinitionParams,
  type Location,
  LSPErrorCodes,
  type ReferenceParams,
  type RenameParams,
  ResponseError,
  type TextDocuments,
  type WorkspaceEdit,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { definitionAt, renameAt, usesAt } from "../../ide/names/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspRangeOf, positionOf, textEditOf } from "../positions.js";

export function definitionHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: DefinitionParams) => Location | null {
  return (params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);

    if (document === undefined) {
      return null;
    }

    const snapshot = host.snapshotOf(document);
    const position = positionOf(params.position);
    const definition = definitionAt(snapshot, position);

    if (definition === null) {
      return null;
    }

    const range = lspRangeOf(definition);
    return { uri, range };
  };
}

export function referencesHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: ReferenceParams) => Location[] | null {
  return (params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);

    if (document === undefined) {
      return null;
    }

    const snapshot = host.snapshotOf(document);
    const position = positionOf(params.position);
    const uses = usesAt(snapshot, position);
    const definition = definitionAt(snapshot, position);
    const isDeclarationAsked = params.context.includeDeclaration;
    const declared = isDeclarationAsked && definition !== null;
    const ranges = declared ? [definition, ...uses] : uses;

    return ranges.map((found) => {
      const range = lspRangeOf(found);
      return { uri, range };
    });
  };
}

export function renameHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
): (params: RenameParams) => WorkspaceEdit | ResponseError {
  return (params) => {
    const uri = params.textDocument.uri;
    const document = documents.get(uri);

    if (document === undefined) {
      const message = `The document ${uri} is not open.`;
      return new ResponseError(LSPErrorCodes.RequestFailed, message);
    }

    const snapshot = host.snapshotOf(document);
    const position = positionOf(params.position);
    const renaming = renameAt(snapshot, position, params.newName);

    switch (renaming.kind) {
      case "renamed": {
        const edits = renaming.changes.map(textEditOf);
        return { changes: { [uri]: edits } };
      }
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, renaming.reason);
    }
  };
}
