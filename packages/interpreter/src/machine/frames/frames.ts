import type { JsonArray, JsonValue } from "../../api/index.js";
import type {
  Extend,
  Handle,
  Loop,
  Parallel,
  Perform,
  Stream,
  TaskList,
  TaskTerm,
  Term,
} from "../../core/index.js";
import type { Completion, Signal } from "../completions/index.js";
import type { ItemKey, Path, RetryKey, SchemaKey } from "../identity/index.js";
import type { Address, FiberId, Scope } from "../registers/index.js";
import type { Consumption, StreamWindow } from "./streams.js";

export interface PerformAnswer {
  readonly kind: "perform";
  readonly at: Path;
  readonly perform: Perform;
  readonly carried: JsonValue;
}

export type Awaited = PerformAnswer | SchemaKey | RetryKey;

export interface UnopenedWindow {
  readonly kind: "unopened";
}

export interface UnlimitedWindow {
  readonly kind: "unlimited";
}

export interface WindowUntil {
  readonly kind: "until";
  readonly instant: number;
}

export type RetryWindow = UnopenedWindow | UnlimitedWindow | WindowUntil;

export interface Attempt {
  readonly number: number;
  readonly input: JsonValue;
  readonly firstStarted: number;
  readonly window: RetryWindow;
}

interface Pending {
  readonly kind: "pending";
}

interface JoinedOutput {
  readonly kind: "joined";
  readonly output: JsonValue;
}

export type Joined = Pending | JoinedOutput;

export interface SequenceK {
  readonly kind: "sequence";
  readonly rest: readonly Term[];
  readonly signal: Signal;
  readonly scope: Scope;
}

export interface TaskListK {
  readonly kind: "taskList";
  readonly list: TaskList;
  readonly index: number;
  readonly visits: readonly number[];
  readonly scope: Scope;
}

export interface TaskK {
  readonly kind: "task";
  readonly task: TaskTerm;
  readonly activation: Address;
}

export interface ValidateK {
  readonly kind: "validate";
  readonly subject: JsonValue;
}

export interface ExportK {
  readonly kind: "export";
  readonly context: JsonValue;
  readonly value: JsonValue;
}

export interface LoopK {
  readonly kind: "loop";
  readonly loop: Loop;
  readonly items: JsonArray;
  readonly index: number;
  readonly scope: Scope;
}

export interface AwaitK {
  readonly kind: "await";
  readonly effect: Awaited;
  readonly activation: Address;
}

export interface HandleK {
  readonly kind: "handle";
  readonly handle: Handle;
  readonly attempt: Attempt;
  readonly scope: Scope;
}

export interface RetryK {
  readonly kind: "retry";
  readonly handle: Handle;
  readonly attempt: Attempt;
  readonly scope: Scope;
}

export interface DeadlineK {
  readonly kind: "deadline";
  readonly instant: number;
}

export interface JoinK {
  readonly kind: "join";
  readonly parallel: Parallel;
  readonly branches: readonly FiberId[];
  readonly outputs: readonly Joined[];
}

export interface BranchK {
  readonly kind: "branch";
  readonly index: number;
}

export interface StreamK {
  readonly kind: "stream";
  readonly stream: Stream;
  readonly consumption: Consumption;
  readonly window: StreamWindow;
  readonly input: JsonValue;
  readonly scope: Scope;
}

export interface ReceiveK {
  readonly kind: "receive";
  readonly stream: Stream;
  readonly consumption: Consumption;
  readonly window: StreamWindow;
  readonly input: JsonValue;
  readonly effect: ItemKey;
  readonly scope: Scope;
}

export type StreamFrame = StreamK | ReceiveK;

export interface StreamItem {
  readonly value: JsonValue;
  readonly index: number;
}

export interface StreamItemK {
  readonly kind: "streamItem";
  readonly stream: Stream;
  readonly iterator: number;
  readonly item: StreamItem;
  readonly scope: Scope;
}

export interface BeforeK {
  readonly kind: "before";
  readonly extend: Extend;
  readonly applying: readonly number[];
  readonly at: number;
  readonly value: JsonValue;
  readonly scope: Scope;
}

export interface StagesK {
  readonly kind: "stages";
  readonly extend: Extend;
  readonly applying: readonly number[];
  readonly scope: Scope;
}

export interface AfterK {
  readonly kind: "after";
  readonly extend: Extend;
  readonly applying: readonly number[];
  readonly at: number;
  readonly completion: Completion;
  readonly scope: Scope;
}

export interface InvokeK {
  readonly kind: "invoke";
}

export interface WorkflowK {
  readonly kind: "workflow";
  readonly activation: Address;
}

export interface TriggerK {
  readonly kind: "trigger";
  readonly activation: Address;
}

export type Frame =
  | SequenceK
  | TaskListK
  | TaskK
  | ValidateK
  | ExportK
  | LoopK
  | AwaitK
  | HandleK
  | RetryK
  | DeadlineK
  | JoinK
  | BranchK
  | StreamK
  | ReceiveK
  | StreamItemK
  | BeforeK
  | StagesK
  | AfterK
  | InvokeK
  | WorkflowK
  | TriggerK;
