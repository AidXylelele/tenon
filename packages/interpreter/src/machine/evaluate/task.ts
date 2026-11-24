import type { TaskTerm } from "../../core/index.js";
import { taskK } from "../frames/index.js";
import { type TaskReport, taskEventOf } from "../lifecycle/index.js";
import {
  type Activation,
  type Here,
  activationOf,
  withActivation,
} from "../registers/index.js";
import {
  type Transition,
  type Write,
  allocated,
  evaluating,
  reported,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function evaluateTask(
  term: TaskTerm,
  here: Here,
  view: View,
): Transition {
  const address = view.store.next;
  const cell = activationOf({
    descriptor: term.descriptor,
    enclosing: here.scope.activation,
    path: here.scope.path,
    startedAt: view.context.now,
  });
  const writes = createdOf(cell, view);
  const frame = taskK({ task: term, activation: address });
  const frames = [frame];
  const scope = withActivation(here.scope, address);
  const inside: Here = { scope, value: here.value };
  const next = evaluating(term.body, inside);

  return transitionOf(next, frames, writes);
}

function createdOf(cell: Activation, view: View): readonly Write[] {
  const allocation = allocated(cell);
  const report: TaskReport = { name: "task.created", cell, details: {} };
  const event = taskEventOf(report, view);
  const creation = reported(event);

  return [allocation, creation];
}
