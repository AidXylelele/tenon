import type { EditorView, ViewUpdate } from "@codemirror/view";
import type {
  EditAction,
  Step,
  StepFormResult,
  StepVariant,
  StructureResult,
  WorkflowFormResult,
} from "language-server/protocol";
import type { Diagnostic, Position } from "vscode-languageserver-protocol";
import type { Problem } from "@/libs/data-access/problem";
import type {
  DraftRevision,
  HostProfile,
  InstanceSummary,
  Person,
  TaskRecord,
  Version,
} from "@/libs/data-access/types";
import type { JsonObject } from "@/libs/json/json";
import type { WorkflowSession } from "@/operations/workflow-language";
import type { InsertPlace } from "@/features/workflow-flow";
import type { Webhook } from "./step-form";

export interface EditingSession {
  readonly session: WorkflowSession;
  readonly structure: StructureResult | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly selected: Step | null;
  readonly selectedId: string | null;
  readonly form: StepFormResult | null;
  readonly protection: StepFormResult | null;
  readonly formless: boolean;
  readonly startForm: WorkflowFormResult | null;
  readonly startFormless: boolean;
  readonly variants: readonly StepVariant[];
  readonly refusal: string | null;
  readonly view: () => EditorView | null;
  readonly onView: (view: EditorView) => void;
  readonly onUpdate: (update: ViewUpdate) => void;
  readonly select: (step: string | null) => void;
  readonly reveal: (start: Position) => void;
  readonly edit: (
    actions: readonly EditAction[],
    remembered?: boolean,
  ) => Promise<boolean>;
}

export type FormReading =
  | {
      readonly kind: "step";
      readonly id: string;
      readonly form: StepFormResult | null;
      readonly protection: StepFormResult | null;
    }
  | { readonly kind: "start"; readonly form: WorkflowFormResult | null };

export type Aside =
  | { readonly kind: "form" }
  | { readonly kind: "catalog"; readonly place: InsertPlace }
  | { readonly kind: "test" }
  | { readonly kind: "problems" };

export type CodeShown = "flow" | "code";

export interface TestRun {
  readonly run: InstanceSummary;
  readonly records: readonly TaskRecord[];
}

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

export interface TestRunParams extends WorkflowName {
  readonly run: string;
}

export interface VersionParams extends WorkflowName {
  readonly version: string;
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

export interface Starts {
  readonly on: boolean;
}

export interface EditorProps {
  readonly opening: Opening;
  readonly profile: HostProfile;
  readonly secretNames: readonly string[];
  readonly webhooks: readonly Webhook[];
  readonly starts: Starts | null;
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

export interface Held {
  readonly kind: "held";
}

export type Publication =
  | { readonly kind: "published"; readonly version: Version }
  | { readonly kind: "refused"; readonly problem: Problem }
  | Held;

export type TestStart =
  | { readonly kind: "started"; readonly run: InstanceSummary }
  | { readonly kind: "refused"; readonly problem: Problem }
  | Held;

export interface VersionChoice {
  readonly kind: "fix" | "feature" | "breaking";
  readonly words: string;
  readonly version: string;
}

export interface StepChange {
  readonly id: string;
  readonly name: string;
  readonly kind: "added" | "changed" | "removed";
}

export type ChangeReading =
  | { readonly kind: "reading" }
  | { readonly kind: "read"; readonly changes: readonly StepChange[] }
  | { readonly kind: "unread" };

export interface PublishChoice {
  readonly version: string;
  readonly turnOn: boolean;
}
