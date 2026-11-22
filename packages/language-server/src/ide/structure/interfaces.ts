import type {
  Range,
  RangeLocator,
  SemanticModel,
  TaskKind,
} from "interpreter/front-end";
import type { StepFamily } from "../families/index.js";
import type { ListPart, ListRole, StepTree } from "../steps/index.js";
import type { StepVariant } from "../variants/index.js";

export interface Trigger {
  readonly kind: "every" | "cron" | "after" | "on";
  readonly pointer: string;
  readonly summary: string;
  readonly milliseconds: number | null;
}

export interface Transition {
  readonly on: "done" | "case" | "caught";
  readonly case: string | null;
  readonly when: string | null;
  readonly kind: "next" | "jump" | "exit" | "end";
  readonly to: string | null;
}

export interface Step<Place = Range> {
  readonly id: string;
  readonly pointer: string;
  readonly name: string;
  readonly kind: TaskKind;
  readonly variant: StepVariant | null;
  readonly family: StepFamily;
  readonly summary: string | null;
  readonly milliseconds: number | null;
  readonly note: string | null;
  readonly range: Place | null;
  readonly selectionRange: Place | null;
  readonly lists: readonly NestedList<Place>[];
  readonly flow: readonly Transition[];
}

export interface StepList<Place = Range> {
  readonly id: string;
  readonly pointer: string;
  readonly role: ListRole;
  readonly steps: readonly Step<Place>[];
}

export interface NestedList<Place = Range> extends StepList<Place> {
  readonly part: ListPart;
}

export interface WorkflowStructure<Place = Range> {
  readonly namespace: string | null;
  readonly name: string | null;
  readonly title: string | null;
  readonly triggers: readonly Trigger[];
  readonly steps: StepList<Place>;
}

export interface StructureReading {
  readonly stale: boolean;
  readonly workflow: WorkflowStructure;
}

export interface Sources {
  readonly model: SemanticModel;
  readonly tree: StepTree;
  readonly positions: RangeLocator | null;
}

export type Destination = Pick<Transition, "kind" | "to">;
