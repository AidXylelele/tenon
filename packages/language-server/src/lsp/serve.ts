import type { Analyzer } from "interpreter/front-end";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  type Connection,
  createConnection,
  ErrorCodes,
  type InitializeError,
  type InitializeParams,
  LSPErrorCodes,
  PublishDiagnosticsNotification,
  ResponseError,
  type TextDocumentChangeEvent,
  TextDocuments,
} from "vscode-languageserver/browser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { problemsOf } from "../ide/snapshot/index.js";
import type { InitializationOptions } from "../protocol/index.js";
import { AnalysisHost } from "./analysis-host.js";
import { serverCapabilities } from "./capabilities.js";
import { lspDiagnosticOf } from "./diagnostics.js";
import {
  dataAtHandlerOf,
  dataAtRequest,
  didFetchImportsNotification,
  documentHandlerOf,
  documentRequest,
  editHandlerOf,
  editRequest,
  fetchedImportsHandlerOf,
  fromJsonAnswerOf,
  fromJsonRequest,
  importsAskOf,
  newDocumentHandlerOf,
  newDocumentRequest,
  rangesOfHandlerOf,
  rangesOfRequest,
  stepFormHandlerOf,
  stepFormRequest,
  stepVariantsHandlerOf,
  stepVariantsRequest,
  workflowFormHandlerOf,
  workflowFormRequest,
  structureHandlerOf,
  structureRequest,
} from "./extensions/index.js";
import type { HeldDocuments } from "./interfaces.js";
import { Lifecycle } from "./lifecycle.js";
import { notify } from "./notifications.js";
import { DiagnosticsSchedule } from "./schedule.js";
import { holdsInitializationOptions } from "./shapes.js";
import {
  codeActionHandlerOf,
  completionHandlerOf,
  definitionHandlerOf,
  hoverHandlerOf,
  referencesHandlerOf,
  renameHandlerOf,
} from "./standard/index.js";

const pause = 200;

export function serve(
  endpoint: MessagePort | DedicatedWorkerGlobalScope,
  start: () => Promise<Analyzer>,
): void {
  const reader = new BrowserMessageReader(endpoint);
  const writer = new BrowserMessageWriter(endpoint);
  const connection = createConnection(reader, writer);
  const log = (line: string) => {
    connection.console.error(line);
  };
  const lifecycle = new Lifecycle(log);
  const started = startAboveFloor(start);

  connection.onRequest(() => lifecycle.refusal());

  const initialize = initializeHandlerOf(connection, lifecycle, started);
  connection.onInitialize(initialize);

  const answerFromJson = lifecycle.guarded(fromJsonAnswerOf);
  connection.onRequest(fromJsonRequest, answerFromJson);

  const shutdown = lifecycle.guarded(() => {
    lifecycle.shutDown();
  });
  connection.onShutdown(shutdown);

  connection.listen();
}

function startAboveFloor(
  start: () => Promise<Analyzer>,
): Promise<Analyzer | string> {
  const shortfall = floorShortfall();
  const isBelowFloor = shortfall !== null;

  if (isBelowFloor) {
    return Promise.resolve(shortfall);
  }

  const analyzer = start();

  return analyzer.catch(startFailureOf);
}

function startFailureOf(reason: unknown): string {
  const cause = messageOf(reason);

  return `The language server could not start: ${cause}`;
}

function messageOf(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  return String(reason);
}

function initializeHandlerOf(
  connection: Connection,
  lifecycle: Lifecycle,
  started: Promise<Analyzer | string>,
): Parameters<Connection["onInitialize"]>[0] {
  return async (params) => {
    const admitted = admittedOptionsOf(lifecycle, params);
    const isRefused = admitted instanceof ResponseError;

    if (isRefused) {
      return admitted;
    }

    lifecycle.begin();
    const outcome = await started;
    const hasFailed = typeof outcome === "string";

    if (hasFailed) {
      return failStart(lifecycle, outcome);
    }

    const profile = admitted.profile;
    const draft = admitted.draft ?? null;
    const host = new AnalysisHost(outcome, profile, draft);
    const documents = new TextDocuments(TextDocument);
    const schemasAt = outcome.schemasAt.bind(outcome);
    const held = { documents, host, schemasAt, profile };
    serveDocuments(connection, lifecycle, held);
    serveFeatures(connection, lifecycle, held);
    lifecycle.run();
    return { capabilities: serverCapabilities };
  };
}

function admittedOptionsOf(
  lifecycle: Lifecycle,
  params: InitializeParams,
): InitializationOptions | ResponseError<InitializeError> {
  const isFirst = lifecycle.phase === "starting";

  if (!isFirst) {
    return initializeRefusalOf(
      ErrorCodes.InvalidRequest,
      "The language server is initialized once.",
    );
  }

  const options: unknown = params.initializationOptions;
  const holdsOptions = holdsInitializationOptions(options);

  if (!holdsOptions) {
    return initializeRefusalOf(
      ErrorCodes.InvalidParams,
      "The initialization options hold no host profile, or a draft that is not a namespace and a name.",
    );
  }

  return options;
}

function failStart(
  lifecycle: Lifecycle,
  reason: string,
): ResponseError<InitializeError> {
  lifecycle.fail(reason);

  return initializeRefusalOf(LSPErrorCodes.RequestFailed, reason);
}

function initializeRefusalOf(
  code: number,
  message: string,
): ResponseError<InitializeError> {
  const noRetry: InitializeError = { retry: false };

  return new ResponseError<InitializeError>(code, message, noRetry);
}

function serveDocuments(
  connection: Connection,
  lifecycle: Lifecycle,
  held: HeldDocuments,
): void {
  const { documents, host } = held;
  const pushDiagnostics = pushOf(connection, host);
  const publish = lifecycle.contained(pushDiagnostics);
  const schedule = new DiagnosticsSchedule(publish, pause);
  const restartPause = changeHandlerOf(schedule);
  const clearDiagnostics = closeHandlerOf(connection, schedule, host);
  const readDocument = documentHandlerOf(documents, host);
  const placePointers = rangesOfHandlerOf(documents, host);
  const receiveImports = fetchedImportsHandlerOf(documents, host, schedule);
  const changed = lifecycle.contained(restartPause);
  const closed = lifecycle.contained(clearDiagnostics);
  const answerDocument = lifecycle.guarded(readDocument);
  const answerRanges = lifecycle.guarded(placePointers);
  const received = lifecycle.contained(receiveImports);

  documents.onDidChangeContent(changed);
  documents.onDidClose(closed);
  documents.listen(connection);
  connection.onRequest(documentRequest, answerDocument);
  connection.onRequest(rangesOfRequest, answerRanges);
  connection.onNotification(didFetchImportsNotification, received);
}

function serveFeatures(
  connection: Connection,
  lifecycle: Lifecycle,
  held: HeldDocuments,
): void {
  const { documents, host, schemasAt, profile } = held;
  const reads = { schemasAt, profile };
  const complete = completionHandlerOf(documents, host, reads);
  const hover = hoverHandlerOf(documents, host, schemasAt);
  const fix = codeActionHandlerOf(documents, host);
  const define = definitionHandlerOf(documents, host);
  const findUses = referencesHandlerOf(documents, host);
  const rename = renameHandlerOf(documents, host);
  const project = structureHandlerOf(documents, host);
  const formStep = stepFormHandlerOf(documents, host, schemasAt);
  const formWorkflow = workflowFormHandlerOf(documents, host, reads);
  const readData = dataAtHandlerOf(documents, host);
  const edit = editHandlerOf(documents, host);
  const writeNew = newDocumentHandlerOf(host);
  const listVariants = stepVariantsHandlerOf(host);
  const answerCompletion = lifecycle.guarded(complete);
  const answerHover = lifecycle.guarded(hover);
  const answerCodeAction = lifecycle.guarded(fix);
  const answerDefinition = lifecycle.guarded(define);
  const answerReferences = lifecycle.guarded(findUses);
  const answerRename = lifecycle.guarded(rename);
  const answerStructure = lifecycle.guarded(project);
  const answerStepForm = lifecycle.guarded(formStep);
  const answerWorkflowForm = lifecycle.guarded(formWorkflow);
  const answerData = lifecycle.guarded(readData);
  const answerEdit = lifecycle.guarded(edit);
  const answerNewDocument = lifecycle.guarded(writeNew);
  const answerVariants = lifecycle.guarded(listVariants);

  connection.onCompletion(answerCompletion);
  connection.onHover(answerHover);
  connection.onCodeAction(answerCodeAction);
  connection.onDefinition(answerDefinition);
  connection.onReferences(answerReferences);
  connection.onRenameRequest(answerRename);
  connection.onRequest(structureRequest, answerStructure);
  connection.onRequest(stepFormRequest, answerStepForm);
  connection.onRequest(workflowFormRequest, answerWorkflowForm);
  connection.onRequest(dataAtRequest, answerData);
  connection.onRequest(editRequest, answerEdit);
  connection.onRequest(newDocumentRequest, answerNewDocument);
  connection.onRequest(stepVariantsRequest, answerVariants);
}

function pushOf(
  connection: Connection,
  host: AnalysisHost,
): (document: TextDocument) => void {
  const askImports = importsAskOf(connection, host);

  return (document) => {
    const snapshot = host.snapshotOf(document);
    const problems = problemsOf(snapshot);
    const diagnostics = problems.map(lspDiagnosticOf);
    const published = {
      uri: document.uri,
      version: snapshot.version,
      diagnostics,
    };
    notify(connection, PublishDiagnosticsNotification.type, published);
    askImports(document.uri, snapshot);
  };
}

function changeHandlerOf(
  schedule: DiagnosticsSchedule,
): (event: TextDocumentChangeEvent<TextDocument>) => void {
  return (event) => {
    schedule.changed(event.document);
  };
}

function closeHandlerOf(
  connection: Connection,
  schedule: DiagnosticsSchedule,
  host: AnalysisHost,
): (event: TextDocumentChangeEvent<TextDocument>) => void {
  return (event) => {
    const uri = event.document.uri;
    schedule.closed(uri);
    host.forget(uri);
    const cleared = { uri, diagnostics: [] };
    notify(connection, PublishDiagnosticsNotification.type, cleared);
  };
}

function floorShortfall(): string | null {
  const hasWithResolvers = typeof Promise.withResolvers === "function";

  if (hasWithResolvers) {
    return null;
  }

  return "This browser lacks Promise.withResolvers; the editor needs Chrome 119, Firefox 121 or Safari 17.4 or later.";
}
