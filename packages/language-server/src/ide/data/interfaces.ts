import type { ast, Binding, JsonValue } from "interpreter/front-end";
import type { StepNode, StepTree } from "../steps/index.js";

export type DataShape =
  "object" | "list" | "text" | "number" | "boolean" | "unknown";

export interface Shape {
  readonly kind: DataShape;
  readonly members: ReadonlyMap<string, Shape>;
}

export interface DataMember {
  readonly name: string;
  readonly expression: string;
  readonly value: string;
  readonly shape: DataShape;
  readonly members: readonly DataMember[];
}

export type DataSource =
  "step" | "workflowInput" | "variable" | "secret" | "time";

export interface Origin {
  readonly source: DataSource;
  readonly step: string | null;
  readonly needsExport: boolean;
}

export interface DataEntry extends DataMember, Origin {}

export type DataWarning =
  | { readonly kind: "inputNotKnownObject"; readonly step: string }
  | { readonly kind: "mayHoldNothing"; readonly step: string }
  | { readonly kind: "contextNotKnownObject" };

export type DataReading =
  | {
      readonly kind: "data";
      readonly entries: readonly DataEntry[];
      readonly warnings: readonly DataWarning[];
    }
  | { readonly kind: "refused"; readonly reason: string };

export interface DataRequest {
  readonly step: string;
  readonly field: string;
}

export type FieldPlace = "raw" | "definition" | "result";

export interface DataFlow {
  readonly tree: StepTree;
  readonly jumps: ReadonlyMap<string, string>;
  readonly document: JsonValue;
  readonly workflow: ast.Workflow;
  readonly secrets: readonly string[];
}

export interface DataSite {
  readonly flow: DataFlow;
  readonly node: StepNode;
  readonly field: string;
  readonly place: FieldPlace;
  readonly scope: ReadonlyMap<string, Binding>;
}

export interface Reach {
  readonly step: StepNode;
  readonly between: readonly StepNode[];
  readonly producer: StepNode | null;
}
