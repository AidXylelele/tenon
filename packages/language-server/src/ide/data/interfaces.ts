import type { ast, Binding, JsonValue } from "interpreter/front-end";
import type { StepNode, StepNodeList, StepTree } from "../steps/index.js";

export type DataShape =
  "object" | "list" | "text" | "number" | "boolean" | "unknown";

export interface Shape {
  readonly kind: DataShape;
  readonly members: ReadonlyMap<string, Shape>;
  readonly size: number | null;
}

export interface DataMember {
  readonly name: string;
  readonly expression: string;
  readonly value: string;
  readonly isPath: boolean;
  readonly shape: DataShape;
  readonly size: number | null;
  readonly members: readonly DataMember[];
}

export type DataSource =
  "step" | "workflowInput" | "variable" | "secret" | "time";

export interface Origin {
  readonly source: DataSource;
  readonly step: string | null;
  readonly needsExport: boolean;
}

export interface DataEntry extends DataMember, Origin {
  readonly typed: DataMember | null;
}

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
  readonly samples: ReadonlyMap<string, JsonValue>;
  readonly typed: string | null;
}

export type FieldPlace = "raw" | "definition" | "result";

export interface DataFlow {
  readonly tree: StepTree;
  readonly targets: ReadonlySet<string>;
  readonly holders: ReadonlyMap<string, StepNode>;
  readonly exporters: ReadonlyMap<string | null, readonly StepNode[]>;
  readonly document: JsonValue;
  readonly workflow: ast.Workflow;
  readonly secrets: readonly string[];
}

export interface StepShapes {
  readonly incoming: Shape;
  readonly output: Shape;
}

export type Earlier =
  | { readonly kind: "step"; readonly step: StepNode }
  | {
      readonly kind: "block";
      readonly block: StepNode;
      readonly list: StepNodeList;
    };

export interface Offered {
  readonly entry: DataEntry;
  readonly step: StepNode;
}

export interface DataSite {
  readonly flow: DataFlow;
  readonly node: StepNode;
  readonly field: string;
  readonly place: FieldPlace;
  readonly scope: ReadonlyMap<string, Binding>;
  readonly shapes: ReadonlyMap<string, StepShapes>;
  readonly samples: ReadonlyMap<string, JsonValue>;
  readonly typed: readonly string[] | null;
}

export interface Reach {
  readonly step: StepNode;
  readonly producer: StepNode | null;
  readonly isReplaced: boolean;
}
