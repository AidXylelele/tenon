import type { LucideIcon } from "lucide-react";
import type {
  Step,
  StepList,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import type { Ref } from "react";
import type { Trigger } from "@/libs/data-access/types";
import type { StatusLook } from "@/libs/ui/composites/status";
import type { RovingItemProps } from "@/libs/ui/hooks/use-roving-focus";
import type { StepStatus } from "@/operations/run-progress";
import type { FlowViewStore } from "./flow-view-store";

export interface Iteration {
  readonly shown: number;
  readonly count: number;
}

export interface StepRun {
  readonly status: StepStatus;
  readonly detail: string | null;
  readonly branch?: string;
  readonly iteration?: Iteration;
}

export type StepMark =
  | {
      readonly kind: "problem";
      readonly count: number;
      readonly message: string;
      readonly missing: string | null;
    }
  | { readonly kind: "fill"; readonly missing: string };

export type InsertPlace =
  | {
      readonly kind: "list";
      readonly list: string;
      readonly index: number;
      readonly above: string | null;
    }
  | {
      readonly kind: "branch";
      readonly switch: string;
      readonly case: string;
    };

export interface RunStart {
  readonly trigger: Trigger;
  readonly detail: string;
}

export interface EditMode {
  readonly kind: "edit";
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly inserting: InsertPlace | null;
  readonly onInsert: (place: InsertPlace) => void;
}

export interface RunMode {
  readonly kind: "run";
  readonly start: RunStart;
  readonly steps: ReadonlyMap<string, StepRun>;
  readonly ended: boolean;
  readonly onIteration: (step: string, iteration: number) => void;
}

export type FlowMode = { readonly kind: "read" } | EditMode | RunMode;

export interface FlowHandle {
  readonly focusAfterRemoving: (step: string) => void;
}

export interface WorkflowFlowProps {
  readonly workflow: WorkflowStructure;
  readonly mode: FlowMode;
  readonly selected?: string | null;
  readonly onSelect?: (target: string | null) => void;
  readonly ref?: Ref<FlowHandle>;
}

export interface KindLook {
  readonly word: string;
  readonly icon: LucideIcon;
}

export interface StateLook {
  readonly tone: StatusLook["tone"];
  readonly icon: LucideIcon;
}

export interface ExitLook {
  readonly words: string;
  readonly icon: LucideIcon;
}

export interface Lane {
  readonly note: string | null;
  readonly then: string | null;
}

export interface StartLook {
  readonly title: string;
  readonly detail: string;
  readonly icon: LucideIcon;
}

export type Exit =
  | { readonly kind: "next" }
  | { readonly kind: "end" }
  | { readonly kind: "exit" }
  | {
      readonly kind: "jump";
      readonly to: string | null;
      readonly name: string | null;
    };

export interface Branch {
  readonly case: string;
  readonly name: string;
  readonly when: string | null;
  readonly exit: Exit;
}

export interface Jump {
  readonly key: string;
  readonly list: string;
  readonly from: string;
  readonly fromName: string;
  readonly to: string;
  readonly between: readonly string[];
  readonly lane: number;
  readonly case: string | null;
  readonly branch: string | null;
}

export interface JumpTransition {
  readonly step: Step;
  readonly transition: Transition;
  readonly to: string;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface JumpBoxes {
  readonly jump: Jump;
  readonly source: Box;
  readonly target: Box;
  readonly between: readonly Box[];
}

export interface JumpLine {
  readonly key: string;
  readonly path: string;
  readonly arrow: string;
}

export interface PlacedStep {
  readonly step: Step;
  readonly list: StepList;
  readonly index: number;
}

export interface StepPlace {
  readonly list: string;
  readonly index: number;
  readonly size: number;
}

export type RunLook = StatusLook & { readonly live: boolean };

export type Line = "plain" | "taken" | "dim";

export interface PlusProps {
  readonly item: string;
  readonly label: string;
  readonly place: InsertPlace;
}

export interface Removal {
  readonly step: string;
  readonly focus: readonly string[];
}

export interface RunView {
  readonly steps: ReadonlyMap<string, StepRun>;
  readonly ended: boolean;
}

export interface FlowView {
  readonly selected: string | null;
  readonly itemProps: (item: string) => RovingItemProps;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly inserting: InsertPlace | null;
  readonly run: RunView | null;
}

export interface FlowState {
  readonly kind: FlowMode["kind"];
  readonly onSelect: ((target: string | null) => void) | null;
  readonly onInsert: ((place: InsertPlace) => void) | null;
  readonly onIteration: ((step: string, iteration: number) => void) | null;
  readonly start: RunStart | null;
  readonly sources: ReadonlyMap<string, string>;
  readonly store: FlowViewStore;
}
