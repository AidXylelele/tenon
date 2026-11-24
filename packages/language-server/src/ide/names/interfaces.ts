import type { ComponentKind } from "../places/index.js";
import type { StepNode } from "../steps/index.js";
import type { TextChange } from "../text/index.js";

export type Renaming =
  | { readonly kind: "renamed"; readonly changes: readonly TextChange[] }
  | { readonly kind: "refused"; readonly reason: string };

export type Named =
  | { readonly kind: "task"; readonly step: StepNode }
  | {
      readonly kind: "component";
      readonly table: ComponentKind;
      readonly name: string;
    };
