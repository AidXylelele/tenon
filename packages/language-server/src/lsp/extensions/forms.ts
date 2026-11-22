import {
  LSPErrorCodes,
  RequestType,
  ResponseError,
  type TextDocuments,
} from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  type FormField,
  formOf,
  workflowFormOf,
} from "../../ide/forms/index.js";
import type { HostReads, SchemasAt } from "../../ide/places/index.js";
import type * as protocol from "../../protocol/index.js";
import { methods } from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";
import { lspDiagnosticOf } from "../diagnostics.js";
import {
  holdsStepFormParams,
  holdsVersionedDocument,
  invalidParamsOf,
} from "../shapes.js";
import { versionedSnapshotOf } from "./versioned.js";

export const stepFormRequest = new RequestType<
  protocol.StepFormParams,
  protocol.StepFormResult,
  void
>(methods.stepForm);

export function stepFormHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  schemasAt: SchemasAt,
): (params: unknown) => protocol.StepFormResult | ResponseError {
  return (params) => {
    const isValid = holdsStepFormParams(params);

    if (!isValid) {
      return invalidParamsOf(methods.stepForm);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const reading = formOf(snapshot, params.step, schemasAt);

    switch (reading.kind) {
      case "form": {
        const fields = reading.fields.map(lspFieldOf);
        const { version } = snapshot;
        const { step } = params;
        return { version, step, failure: reading.failure, fields };
      }
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, reading.reason);
    }
  };
}

export const workflowFormRequest = new RequestType<
  protocol.WorkflowFormParams,
  protocol.WorkflowFormResult,
  void
>(methods.workflowForm);

export function workflowFormHandlerOf(
  documents: TextDocuments<TextDocument>,
  host: AnalysisHost,
  reads: HostReads,
): (params: unknown) => protocol.WorkflowFormResult | ResponseError {
  return (params) => {
    const isValid = holdsVersionedDocument(params);

    if (!isValid) {
      return invalidParamsOf(methods.workflowForm);
    }

    const identifier = params.textDocument;
    const snapshot = versionedSnapshotOf(documents, host, identifier);
    const isRefused = snapshot instanceof ResponseError;

    if (isRefused) {
      return snapshot;
    }

    const reading = workflowFormOf(snapshot, reads);

    switch (reading.kind) {
      case "form": {
        const fields = reading.fields.map(lspFieldOf);
        return { version: snapshot.version, fields };
      }
      case "refused":
        return new ResponseError(LSPErrorCodes.RequestFailed, reading.reason);
    }
  };
}

function lspFieldOf(field: FormField): protocol.FormField {
  const fields = field.fields.map(lspFieldOf);
  const diagnostics = field.diagnostics.map(lspDiagnosticOf);

  return { ...field, fields, diagnostics };
}
