import type { JsonObject } from "../../api/index.js";
import { placedAt } from "../../runtime/index.js";
import { retryTimerOf } from "../effects/index.js";
import { type AwaitK, type HandleK, awaitK, retryK } from "../frames/index.js";
import { effectIdOf } from "../identity/index.js";
import {
  type TaskReport,
  awaitedPhaseOf,
  phaseChangedOf,
  taskEventOf,
} from "../lifecycle/index.js";
import { type Retrying, decisionOf } from "../retry/index.js";
import {
  type Transition,
  type Write,
  evaluating,
  reported,
  requested,
  suspending,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";
import { passedOn } from "./pass.js";

export function raiseAtHandle(
  frame: HandleK,
  error: JsonObject,
  view: View,
): Transition {
  const cell = view.store.cellAt(frame.scope.activation);
  const placed = placedAt(error, cell.descriptor.reference);
  const decision = decisionOf(frame, placed, view);

  switch (decision.kind) {
    case "pass":
    case "reraise":
      return passedOn(placed);
    case "recover": {
      const next = evaluating(decision.body, decision.here);
      return transitionOf(next, [], []);
    }
    case "retry":
      return retriedOf(frame, decision, view);
  }
}

function retriedOf(frame: HandleK, retrying: Retrying, view: View): Transition {
  const id = effectIdOf(retrying.timer);
  const timer = retryTimerOf(id, retrying.until, view);
  const asked = requested(timer);
  const retry = retryK({
    handle: frame.handle,
    attempt: retrying.next,
    scope: frame.scope,
  });
  const awaiting = awaitK({
    effect: retrying.timer,
    activation: frame.scope.activation,
  });
  const retried = taskRetriedOf(frame, awaiting, view);
  const frames = [retry, awaiting];
  const writes = [...retried, asked];

  return transitionOf(suspending, frames, writes);
}

function taskRetriedOf(
  frame: HandleK,
  awaiting: AwaitK,
  view: View,
): readonly Write[] {
  const address = frame.scope.activation;
  const cell = view.store.cellAt(address);
  const report: TaskReport = { name: "task.retried", cell, details: {} };
  const event = taskEventOf(report, view);
  const retried = reported(event);
  const awaited = awaitedPhaseOf(awaiting);
  const phase = phaseChangedOf(address, awaited, view);

  return [retried, ...phase];
}
