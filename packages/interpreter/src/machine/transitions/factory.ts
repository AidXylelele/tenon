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
import type { Completion } from "../completions/index.js";
import type { Frame } from "../frames/index.js";
import type { Activation, Address, FiberId, Here } from "../registers/index.js";
import type { OwnedAt } from "../time/index.js";
import type {
  Allocated,
  BranchReport,
  Cancellation,
  Committed,
  Declined,
  Ending,
  Evaluating,
  Expiring,
  Finishing,
  Forking,
  Freed,
  Given,
  Gone,
  Interrupting,
  Next,
  Queued,
  Raising,
  Reported,
  Requested,
  Responding,
  Resumed,
  Returning,
  RunResult,
  Started,
  Suspended,
  Suspending,
  Taken,
  Transition,
  Unwinding,
  Updated,
  Withdrawn,
  Write,
} from "./transitions.js";

export function evaluating(term: Term, here: Here): Evaluating {
  return { kind: "evaluate", term, here };
}

export function returning(completion: Completion): Returning {
  return { kind: "return", completion };
}

export function raising(error: JsonObject): Raising {
  return { kind: "raise", error };
}

export function responding(outcome: EffectOutcome): Responding {
  return { kind: "respond", outcome };
}

export function expiryOf(owner: OwnedAt): Interrupting {
  return { kind: "interrupt", stop: { kind: "deadline", depth: owner.depth } };
}

export const cancelling: Interrupting = {
  kind: "interrupt",
  stop: { kind: "bottom" },
};

export const suspending: Suspending = { kind: "suspend" };

export function expiring(owner: OwnedAt): Expiring {
  return { kind: "expire", owner };
}

export function unwinding(
  fibers: readonly FiberId[],
  then: Interrupting,
): Unwinding {
  return { kind: "unwind", fibers, then };
}

const gone: Gone = { kind: "gone" };

export function forking(branches: readonly Evaluating[]): Forking {
  return { kind: "fork", branches };
}

export function ending(report: BranchReport): Ending {
  return { kind: "end", report };
}

export function branchCompleted(
  index: number,
  completion: Completion,
): BranchReport {
  return { kind: "completed", index, completion };
}

export function branchRaised(index: number, error: JsonObject): BranchReport {
  return { kind: "raised", index, error };
}

export function finishing(result: RunResult): Finishing {
  return { kind: "finish", result };
}

export function completedWith(output: JsonValue): RunResult {
  return { kind: "completed", output };
}

export function faultedWith(error: JsonObject): RunResult {
  return { kind: "faulted", error };
}

export const cancelledRun: RunResult = { kind: "cancelled" };

export function transitionOf(
  next: Next,
  push: readonly Frame[],
  writes: readonly Write[],
): Transition {
  return { next, push, writes };
}

export const onward: Cancellation["next"] = { kind: "onward" };

export function onwardAfter(fibers: readonly FiberId[]): Cancellation["next"] {
  return { kind: "after", fibers };
}

export function cancellationOf(
  next: Cancellation["next"],
  writes: readonly Write[],
): Cancellation {
  return { next, writes };
}

export const nothingCancelled: Cancellation = { next: onward, writes: [] };

export const branchGone: Cancellation = { next: gone, writes: [] };

export function allocated(activation: Activation): Allocated {
  return { kind: "allocated", activation };
}

export function updated(address: Address, activation: Activation): Updated {
  return { kind: "updated", address, activation };
}

export function freed(address: Address): Freed {
  return { kind: "freed", address };
}

export function committed(context: JsonValue): Committed {
  return { kind: "committed", context };
}

export function startedOn(input: JsonValue, at: number): Started {
  return { kind: "started", input, at };
}

export const runSuspended: Suspended = { kind: "suspended" };

export const runResumed: Resumed = { kind: "resumed" };

export function queued(response: EffectResponse): Queued {
  return { kind: "queued", response };
}

export function reported(event: LifecycleEvent): Reported {
  return { kind: "reported", event };
}

export function taken(input: TaskValue): Taken {
  return { kind: "taken", input };
}

export function given(output: TaskValue): Given {
  return { kind: "given", output };
}

export function requested(effect: Effect): Requested {
  return { kind: "requested", effect };
}

export function withdrawn(id: EffectId): Withdrawn {
  return { kind: "withdrawn", id };
}

export function declined(id: string): Declined {
  return { kind: "declined", id };
}
