import type { HostProfile, JsonValue } from "interpreter/front-end";
import type {
  Diagnostic,
  Range,
  TextDocumentIdentifier,
  TextEdit,
  VersionedTextDocumentIdentifier,
} from "vscode-languageserver/browser";
import type { EditAction, IdChange } from "../ide/edits/index.js";
import type * as forms from "../ide/forms/index.js";
import type { DraftAddress } from "../ide/snapshot/index.js";
import type { FailureKind } from "../ide/steps/index.js";
import type * as structure from "../ide/structure/index.js";

export interface InitializationOptions {
  readonly profile: HostProfile;
  readonly draft?: DraftAddress;
}

export interface DocumentParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
}

export type DocumentResult =
  | {
      readonly kind: "document";
      readonly version: number;
      readonly document: JsonValue;
    }
  | {
      readonly kind: "refused";
      readonly version: number;
      readonly diagnostics: readonly Diagnostic[];
    };

export interface FromJsonParams {
  readonly document: JsonValue;
}

export interface FromJsonResult {
  readonly text: string;
}

export interface RangesOfParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
  readonly pointers: readonly string[];
}

export interface RangesOfResult {
  readonly version: number;
  readonly ranges: readonly (Range | null)[];
}

export interface ImportsNeededParams {
  readonly textDocument: TextDocumentIdentifier;
  readonly imports: readonly {
    readonly reference: string;
    readonly uri: string;
  }[];
}

export interface DidFetchImportsParams {
  readonly textDocument: TextDocumentIdentifier;
  readonly texts: Readonly<Record<string, string>>;
  readonly failures?: Readonly<Record<string, string>>;
}

export interface StructureParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
}

export interface StructureResult {
  readonly version: number;
  readonly stale: boolean;
  readonly workflow: WorkflowStructure;
}

export type WorkflowStructure = structure.WorkflowStructure<Range>;

export type StepList = structure.StepList<Range>;

export type NestedList = structure.NestedList<Range>;

export type Step = structure.Step<Range>;

export interface StepFormParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
  readonly step: string;
}

export interface StepFormResult {
  readonly version: number;
  readonly step: string;
  readonly failure: FailureKind;
  readonly fields: readonly FormField[];
}

export interface WorkflowFormParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
}

export interface WorkflowFormResult {
  readonly version: number;
  readonly fields: readonly FormField[];
}

export type FormField = forms.FormField<Diagnostic>;

export interface EditParams {
  readonly textDocument: VersionedTextDocumentIdentifier;
  readonly action: EditAction;
}

export interface EditResult {
  readonly edits: readonly TextEdit[];
  readonly ids: readonly IdChange[];
}
