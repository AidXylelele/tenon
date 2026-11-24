import type {
  Effect,
  EffectId,
  EffectOutcome,
  EffectResponse,
  JsonObject,
  JsonValue,
  LifecycleEvent,
  TaskValue,
} from "../../api/index.js";
import type { Term } from "../../core/index.js";
import type { StatusPhase } from "../../standard/index.js";
import type { Completion } from "../completions/index.js";
import type { Frame } from "../frames/index.js";
import type { Activation, Address, FiberId, Here } from "../registers/index.js";
import type { OwnedAt } from "../time/index.js";

export interface Evaluating {
  readonly kind: "evaluate";
  readonly term: Term;
  readonly here: Here;
}

export interface Returning {
  readonly kind: "return";
  readonly completion: Completion;
}

export interface Raising {
  readonly kind: "raise";
  readonly error: JsonObject;
}

export interface Responding {
  readonly kind: "respond";
  readonly outcome: EffectOutcome;
}

interface AtDeadline {
  readonly kind: "deadline";
  readonly depth: number;
}

interface AtBottom {
  readonly kind: "bottom";
}

export type Stop = AtDeadline | AtBottom;

export interface Interrupting {
  readonly kind: "interrupt";
  readonly stop: Stop;
}

export type Control =
  Evaluating | Returning | Raising | Responding | Interrupting;

export interface Suspending {
  readonly kind: "suspend";
}

export interface Forking {
  readonly kind: "fork";
  readonly branches: readonly Evaluating[];
}

export interface BranchCompleted {
  readonly kind: "completed";
  readonly index: number;
  readonly completion: Completion;
}

interface BranchRaised {
  readonly kind: "raised";
  readonly index: number;
  readonly error: JsonObject;
}

export type BranchReport = BranchCompleted | BranchRaised;

export interface Ending {
  readonly kind: "end";
  readonly report: BranchReport;
}

interface RunCompleted {
  readonly kind: Extract<StatusPhase, "completed">;
  readonly output: JsonValue;
}

interface RunFaulted {
  readonly kind: Extract<StatusPhase, "faulted">;
  readonly error: JsonObject;
}

interface RunCancelled {
  readonly kind: Extract<StatusPhase, "cancelled">;
}

export type RunResult = RunCompleted | RunFaulted | RunCancelled;

export interface Finishing {
  readonly kind: "finish";
  readonly result: RunResult;
}

export interface Expiring {
  readonly kind: "expire";
  readonly owner: OwnedAt;
}

export interface Unwinding {
  readonly kind: "unwind";
  readonly fibers: readonly FiberId[];
  readonly then: Interrupting;
}

export interface Gone {
  readonly kind: "gone";
}

export type Next =
  | Control
  | Suspending
  | Forking
  | Ending
  | Finishing
  | Expiring
  | Unwinding
  | Gone;

export interface Allocated {
  readonly kind: "allocated";
  readonly activation: Activation;
}

export interface Updated {
  readonly kind: "updated";
  readonly address: Address;
  readonly activation: Activation;
}

export interface Freed {
  readonly kind: "freed";
  readonly address: Address;
}

export interface Committed {
  readonly kind: "committed";
  readonly context: JsonValue;
}

export interface Reported {
  readonly kind: "reported";
  readonly event: LifecycleEvent;
}

export interface Taken {
  readonly kind: "taken";
  readonly input: TaskValue;
}

export interface Given {
  readonly kind: "given";
  readonly output: TaskValue;
}

export interface Requested {
  readonly kind: "requested";
  readonly effect: Effect;
}

export interface Withdrawn {
  readonly kind: "withdrawn";
  readonly id: EffectId;
}

export interface Declined {
  readonly kind: "declined";
  readonly id: string;
}

export interface Started {
  readonly kind: "started";
  readonly input: JsonValue;
  readonly at: number;
}

export interface Suspended {
  readonly kind: "suspended";
}

export interface Resumed {
  readonly kind: "resumed";
}

export interface Queued {
  readonly kind: "queued";
  readonly response: EffectResponse;
}

export type Write =
  | Allocated
  | Updated
  | Freed
  | Committed
  | Started
  | Suspended
  | Resumed
  | Queued
  | Reported
  | Taken
  | Given
  | Requested
  | Withdrawn
  | Declined;

export interface Transition {
  readonly next: Next;
  readonly push: readonly Frame[];
  readonly writes: readonly Write[];
}

interface Onward {
  readonly kind: "onward";
}

interface OnwardAfter {
  readonly kind: "after";
  readonly fibers: readonly FiberId[];
}

export interface Cancellation {
  readonly next: Onward | OnwardAfter | Finishing | Gone;
  readonly writes: readonly Write[];
}
