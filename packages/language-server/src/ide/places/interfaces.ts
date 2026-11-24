import type {
  Analyzer,
  ComponentTable,
  HostProfile,
  SemanticModel,
  SourceDocument,
} from "interpreter/front-end";
import type { StepTree } from "../steps/index.js";

export type ComponentKind = keyof ComponentTable;

export type SchemasAt = Analyzer["schemasAt"];

export interface HostReads {
  readonly schemasAt: SchemasAt;
  readonly profile: HostProfile;
}

export type Place =
  | { readonly kind: "stepName"; readonly step: string }
  | {
      readonly kind: "label";
      readonly directive: string;
      readonly name: string;
    }
  | {
      readonly kind: "member";
      readonly object: string;
      readonly name: string;
      readonly part: "key" | "value";
      readonly pointer: string;
    }
  | {
      readonly kind: "component";
      readonly table: ComponentKind;
      readonly name: string;
      readonly declaration: string;
    }
  | {
      readonly kind: "reference";
      readonly table: ComponentKind;
      readonly pointer: string;
      readonly name: string;
    }
  | { readonly kind: "nothing" };

export interface Semantics {
  readonly model: SemanticModel;
  readonly tree: StepTree;
}

export interface Reading {
  readonly text: string;
  readonly source: SourceDocument | null;
  readonly semantics: Semantics | null;
}
