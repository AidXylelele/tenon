import {
  type Connection,
  NotificationType,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { importsNeededOf } from "../../ide/imports/index.js";
import type { Snapshot } from "../../ide/snapshot/index.js";
import {
  type DidFetchImportsParams,
  type ImportsNeededParams,
  methods,
} from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { notify } from "../notifications.js";
import type { DiagnosticsSchedule } from "../schedule.js";
import { holdsFetchedImports } from "../shapes.js";

const importsNeededNotification = new NotificationType<ImportsNeededParams>(
  methods.importsNeeded,
);

export const didFetchImportsNotification =
  new NotificationType<DidFetchImportsParams>(methods.didFetchImports);

export function importsAskOf(
  connection: Connection,
  host: AnalysisHost,
): (uri: string, snapshot: Snapshot) => void {
  return (uri, snapshot) => {
    const needed = importsNeededOf(snapshot.analysis);
    const unasked = host.unasked(uri, needed);
    const isAsking = unasked.length > 0;

    if (!isAsking) {
      return;
    }

    const textDocument = { uri };
    const asking = { textDocument, imports: unasked };
    notify(connection, importsNeededNotification, asking);
    host.asked(uri, unasked);
  };
}

export function fetchedImportsHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  schedule: DiagnosticsSchedule,
): (params: unknown) => void {
  return (params) => {
    const isValid = holdsFetchedImports(params);

    if (!isValid) {
      return;
    }

    const uri = params.textDocument.uri;
    const document = documents.get(uri);
    const isOpen = document !== undefined;

    if (!isOpen) {
      return;
    }

    const failures = params.failures ?? {};
    const arriving = { texts: params.texts, failures };
    host.receive(uri, arriving);
    schedule.changed(document);
  };
}
