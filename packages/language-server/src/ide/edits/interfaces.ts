import type {
  JsonObject,
  JsonValue,
  RangeLocator,
  TaskKind,
} from "interpreter/front-end";
import type { TextChange } from "../text/index.js";
import type { Snapshot } from "../snapshot/index.js";
import type {
  FailureKind,
  StepNode,
  StepNodeList,
  StepTree,
} from "../steps/index.js";

export interface InsertStep {
  readonly kind: "insertStep";
  readonly list: string;
  readonly index: number;
  readonly step: TaskKind;
  readonly name: string | null;
}

export interface MoveStep {
  readonly kind: "moveStep";
  readonly step: string;
  readonly list: string;
  readonly index: number;
}

export interface RemoveStep {
  readonly kind: "removeStep";
  readonly step: string;
}

export interface RenameStep {
  readonly kind: "renameStep";
  readonly step: string;
  readonly name: string;
}

export interface DuplicateStep {
  readonly kind: "duplicateStep";
  readonly step: string;
}

export interface SetField {
  readonly kind: "setField";
  readonly pointer: string;
  readonly value: JsonValue;
}

export interface ClearField {
  readonly kind: "clearField";
  readonly pointer: string;
}

interface Retry {
  readonly kind: "retry";
  readonly attempts: number;
  readonly seconds: number;
  readonly growing: boolean;
}

export type Failure = { readonly kind: Exclude<FailureKind, "retry"> } | Retry;

export interface SetFailure {
  readonly kind: "setFailure";
  readonly step: string;
  readonly failure: Failure;
}

export type StepAction =
  InsertStep | MoveStep | RemoveStep | RenameStep | DuplicateStep | SetFailure;

export type FieldAction = SetField | ClearField;

export type EditAction = StepAction | FieldAction;

export interface IdChange {
  readonly from: string;
  readonly to: string;
}

export type Editing =
  | {
      readonly kind: "edited";
      readonly changes: readonly TextChange[];
      readonly ids: readonly IdChange[];
    }
  | { readonly kind: "refused"; readonly reason: string };

export interface EditableText {
  readonly text: string;
  readonly document: JsonValue;
  readonly positions: RangeLocator;
}

export interface Editable extends EditableText {
  readonly snapshot: Snapshot;
  readonly tree: StepTree;
}

export interface Span {
  readonly start: number;
  readonly end: number;
}

interface WrittenCollection {
  readonly text: string;
  readonly items: readonly Span[];
  readonly empty: string;
}

export type CollectionText =
  | (WrittenCollection & {
      readonly kind: "block";
      readonly indent: number;
      readonly afterKey: number;
      readonly placeholder: Span | null;
    })
  | (WrittenCollection & { readonly kind: "flow"; readonly whole: Span });

export interface ItemText {
  readonly block: string;
  readonly inline: string;
}

export interface WrittenItem {
  readonly text: string;
  readonly value: JsonValue;
}

export interface Placed {
  readonly id: string;
  readonly pointer: string;
}

export interface WrittenStep {
  readonly step: StepNode;
  readonly list: StepNodeList;
  readonly collection: CollectionText;
  readonly span: Span;
}

export interface Destination {
  readonly list: StepNodeList;
  readonly index: number;
}

export interface Wrapping {
  readonly key: string;
  readonly inner: string;
  readonly handling: JsonObject;
  readonly then: string | null;
}
