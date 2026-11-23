import type { EditAction, FormField, Step } from "language-server/protocol";

export type CallKind =
  "http" | "openapi" | "grpc" | "asyncapi" | "mcp" | "a2a" | "function";

export type RunKind = "script" | "shell" | "container" | "workflow";

export type FormKind =
  Exclude<Step["kind"], "call" | "run"> | CallKind | RunKind;

export type WordsKind = FormKind | "start";

export type FieldControl =
  | "value"
  | "data"
  | "condition"
  | "flow"
  | "code"
  | "language"
  | "httpMethod"
  | "values"
  | "cases"
  | "hidden";

export interface FieldWords {
  readonly title: string;
  readonly help: string | null;
  readonly placeholder: string;
  readonly fill: string | null;
  readonly control: FieldControl;
  readonly mono: boolean;
  readonly choices: ReadonlyMap<string, string>;
}

export interface WordsEntry {
  readonly title?: string;
  readonly help?: string;
  readonly placeholder?: string;
  readonly fill?: string;
  readonly control?: FieldControl;
  readonly mono?: boolean;
  readonly choices?: ReadonlyMap<string, string>;
}

export interface FormLayout {
  readonly essentials: readonly FormField[];
  readonly more: readonly FormField[];
  readonly data: readonly FormField[];
  readonly failure: readonly FormField[];
}

export type FailureChoice =
  "stop" | "retryThenStop" | "retryThenHandle" | "continue" | "handle";

export interface RetrySettings {
  readonly retries: number;
  readonly seconds: number;
  readonly growing: boolean;
}

export type RetryCount = "retries" | "seconds";

export interface FailureTarget {
  readonly step: string;
  readonly pointer: string;
}

export interface FailureReading {
  readonly choice: FailureChoice;
  readonly retry: RetrySettings | null;
  readonly target: FailureTarget;
}

export interface FlowChoice {
  readonly value: string;
  readonly text: string;
}

export type FieldState = Pick<
  FormField,
  "pointer" | "required" | "written" | "value"
>;

export type Commit =
  | { readonly kind: "edits"; readonly edits: readonly EditAction[] }
  | { readonly kind: "refused"; readonly reason: string };

export interface ValueRow {
  readonly name: string;
  readonly value: FormField["value"];
}

export interface CaseRow {
  readonly index: number;
  readonly name: string;
  readonly when: string | null;
  readonly then: string;
  readonly isOtherwise: boolean;
}

export type StartWay = "hand" | "schedule" | "webhook" | "event";

export interface StartReading {
  readonly way: StartWay;
  readonly cron: string | null;
  readonly eventType: string | null;
  readonly timed: FormField | null;
}
