import type { EditorView, ViewUpdate } from "@codemirror/view";
import type {
  EditAction,
  Step,
  StepFormResult,
  StructureResult,
  Trigger,
  WorkflowFormResult,
} from "language-server/protocol";
import type { Diagnostic, Position } from "vscode-languageserver-protocol";
import type { Problem } from "@/libs/data-access/problem";
import type {
  DraftRevision,
  HostProfile,
  Person,
  Version,
} from "@/libs/data-access/types";
import type { JsonObject } from "@/libs/json/json";
import type { WorkflowSession } from "@/operations/workflow-language";

export interface EditingSession {
  readonly session: WorkflowSession;
  readonly structure: StructureResult | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly selected: Step | null;
  readonly selectedId: string | null;
  readonly form: StepFormResult | null;
  readonly formless: boolean;
  readonly startForm: WorkflowFormResult | null;
  readonly startFormless: boolean;
  readonly refusal: string | null;
  readonly view: () => EditorView | null;
  readonly onView: (view: EditorView) => void;
  readonly onUpdate: (update: ViewUpdate) => void;
  readonly select: (step: string | null) => void;
  readonly reveal: (start: Position) => void;
  readonly edit: (action: EditAction, remembered?: boolean) => Promise<void>;
}

export interface StartPanelProps {
  readonly triggers: readonly Trigger[];
  readonly form: WorkflowFormResult | null;
  readonly formless: boolean;
  readonly onShow: (trigger: Trigger) => void;
  readonly onEdit: (action: EditAction) => void;
  readonly onClose: () => void;
}

export type FormReading =
  | {
      readonly kind: "step";
      readonly id: string;
      readonly form: StepFormResult | null;
    }
  | { readonly kind: "start"; readonly form: WorkflowFormResult | null };

export interface LeaveGuard {
  readonly leaving: string | null;
  readonly stay: () => void;
  readonly leave: () => void;
}

export interface NamedDraft {
  readonly name: WorkflowName;
  readonly current: DraftRevision;
}

export interface WorkflowName {
  readonly namespace: string;
  readonly name: string;
}

export type Opening =
  | { readonly kind: "new" }
  | {
      readonly kind: "draft";
      readonly workflow: WorkflowName;
      readonly revision: DraftRevision;
      readonly currentVersion: string | null;
    }
  | {
      readonly kind: "version";
      readonly workflow: WorkflowName;
      readonly version: string;
      readonly source: string | null;
      readonly document: JsonObject | null;
    };

export interface EditorProps {
  readonly opening: Opening;
  readonly profile: HostProfile;
  readonly secretNames: readonly string[];
  readonly task: string | null;
  readonly userId: string;
}

type DraftStatus = "clean" | "unsaved" | "saving" | "failed";

interface OpenConflict {
  readonly theirs: DraftRevision;
  readonly base: string | null;
}

export interface DraftState {
  readonly status: DraftStatus;
  readonly saved: { readonly by: Person; readonly at: string } | null;
  readonly failure: string | null;
  readonly retrying: boolean;
  readonly conflict: OpenConflict | null;
}

export type Publication =
  | { readonly kind: "published"; readonly version: Version }
  | { readonly kind: "refused"; readonly problem: Problem }
  | { readonly kind: "held" };
