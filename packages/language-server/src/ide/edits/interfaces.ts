import type {
  ast,
  JsonObject,
  JsonValue,
  Range,
  RangeLocator,
} from "interpreter/front-end";
import type { TextChange } from "../text/index.js";
import type { Condition } from "../conditions/index.js";
import type { Snapshot } from "../snapshot/index.js";
import type { TemplatePart } from "../templates/index.js";
import type { ChosenResult, StepVariant } from "../variants/index.js";
import type {
  ListEnd,
  RetrySetting,
  StepNode,
  StepNodeList,
  StepTree,
} from "../steps/index.js";

export interface InsertStep {
  readonly kind: "insertStep";
  readonly list: string;
  readonly index: number;
  readonly step: StepVariant;
  readonly name: string | null;
}

export interface InsertStepOnBranch {
  readonly kind: "insertStepOnBranch";
  readonly switch: string;
  readonly case: string;
  readonly step: StepVariant;
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

export interface SetCondition {
  readonly kind: "setCondition";
  readonly pointer: string;
  readonly condition: Condition;
}

export interface SetTemplate {
  readonly kind: "setTemplate";
  readonly pointer: string;
  readonly parts: readonly TemplatePart[];
}

export interface ClearField {
  readonly kind: "clearField";
  readonly pointer: string;
}

export type Failure =
  | { readonly kind: "stop" }
  | { readonly kind: "continue" }
  | { readonly kind: "retry"; readonly retry: RetrySetting }
  | { readonly kind: "handle"; readonly retry?: RetrySetting };

export type ProtectingFailure = Exclude<Failure, { readonly kind: "stop" }>;

export type CatchWriting =
  | { readonly kind: "catch"; readonly catch: JsonObject }
  | { readonly kind: "refused"; readonly reason: string };

export type PolicyWriting =
  | { readonly kind: "policy"; readonly policy: JsonObject | null }
  | { readonly kind: "refused"; readonly reason: string };

export interface SetFailure {
  readonly kind: "setFailure";
  readonly step: string;
  readonly failure: Failure;
}

export interface SetResult {
  readonly kind: "setResult";
  readonly step: string;
  readonly result: ChosenResult;
}

export interface UseData {
  readonly kind: "useData";
  readonly pointer: string;
  readonly value: string;
  readonly export: string | null;
}

export type WrapBlock = "try" | "for" | "do";

export interface WrapSteps {
  readonly kind: "wrapSteps";
  readonly steps: readonly string[];
  readonly block: WrapBlock;
  readonly name: string | null;
}

export interface Run {
  readonly list: StepNodeList;
  readonly steps: readonly StepNode[];
  readonly name: string;
}

export interface Redirections {
  readonly inner: readonly SetField[];
  readonly outer: readonly SetField[];
}

export interface RunWrapping {
  readonly run: Run;
  readonly block: WrapBlock;
  readonly jumps: ReadonlyMap<string, string>;
  readonly after: StepNode | null;
  readonly listEnd: ListEnd;
}

export type Redirection =
  | { readonly kind: "kept" }
  | { readonly kind: "set"; readonly setting: SetField }
  | { readonly kind: "refused"; readonly reason: string };

export type StepAction =
  | InsertStep
  | InsertStepOnBranch
  | MoveStep
  | RemoveStep
  | RenameStep
  | DuplicateStep
  | SetFailure
  | SetResult
  | UseData
  | WrapSteps;

export type FieldAction = SetField | ClearField | SetCondition | SetTemplate;

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

export interface WrittenField {
  readonly item: Range;
  readonly node: Range;
}

export interface ValueText {
  readonly text: string;
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

export interface Switching {
  readonly written: WrittenStep;
  readonly task: ast.TaskCommon & ast.SwitchTask;
  readonly chosen: ast.SwitchCase;
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
