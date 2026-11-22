import type { LucideIcon } from "lucide-react";
import type {
  EditAction,
  Step,
  StepList,
  Transition,
  WorkflowStructure,
} from "language-server/protocol";
import type { Phase } from "@/libs/data-access/types";
import type { RovingItemProps } from "@/libs/ui/hooks/use-roving-focus";
import type { StatusLook } from "@/libs/ui/composites/status";

export type StepStatus = Phase | "retrying" | "skipped";

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
    }
  | { readonly kind: "fill"; readonly what: string };

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

export type StepEdit = Extract<
  EditAction,
  { readonly kind: "duplicateStep" | "moveStep" | "wrapSteps" | "removeStep" }
>;

export interface StartWords {
  readonly title: string;
  readonly detail: string;
}

export interface EditMode {
  readonly kind: "edit";
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly inserting: InsertPlace | null;
  readonly onInsert: (place: InsertPlace) => void;
  readonly onEdit: (edit: StepEdit) => void;
}

export interface RunMode {
  readonly kind: "run";
  readonly start: StartWords;
  readonly steps: ReadonlyMap<string, StepRun>;
  readonly ended: boolean;
  readonly onIteration: (step: string, iteration: number) => void;
}

export type FlowMode = { readonly kind: "read" } | EditMode | RunMode;

export interface WorkflowFlowProps {
  readonly workflow: WorkflowStructure;
  readonly mode: FlowMode;
  readonly selected?: string | null;
  readonly onSelect?: (target: string | null) => void;
}

export interface KindLook {
  readonly word: string;
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

export interface StartLook extends StartWords {
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

export interface StepPlace {
  readonly step: Step;
  readonly list: StepList;
  readonly index: number;
}

export type RunLook = StatusLook & { readonly live: boolean };

export type Line = "plain" | "taken" | "dim";

export interface PlusProps {
  readonly item: string;
  readonly label: string;
  readonly place: InsertPlace;
}

export interface Deletion {
  readonly step: string;
  readonly focus: readonly string[];
}

export interface FlowState {
  readonly mode: FlowMode;
  readonly selected: string | null;
  readonly onSelect: ((target: string | null) => void) | undefined;
  readonly itemProps: (item: string) => RovingItemProps;
  readonly sources: ReadonlyMap<string, string>;
  readonly onDeleting: (deletion: Deletion) => void;
}
