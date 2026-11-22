import type {
  Analysis,
  Diagnostic,
  SemanticModel,
} from "interpreter/front-end";

export interface Basis {
  readonly version: number;
  readonly model: SemanticModel;
}

export interface DraftAddress {
  readonly namespace: string;
  readonly name: string;
}

export interface Snapshot {
  readonly version: number;
  readonly text: string;
  readonly analysis: Analysis;
  readonly basis: Basis | null;
  readonly draft: DraftAddress | null;
}

export interface AddressDiagnostic extends Omit<Diagnostic, "code"> {
  readonly code: "draft-address";
}

export type Problem = Diagnostic | AddressDiagnostic;
