import type { Guard } from "../../core/index.js";
import { normalOf } from "../completions/index.js";
import {
  type TaskReport,
  phaseChangedOf,
  taskEventOf,
} from "../lifecycle/index.js";
import type { Address, Here } from "../registers/index.js";
import {
  type Transition,
  type Write,
  evaluating,
  reported,
  returning,
  transitionOf,
} from "../transitions/index.js";
import { holds } from "../values/index.js";
import type { View } from "../view.js";

export function evaluateGuard(term: Guard, here: Here, view: View): Transition {
  const isStarted = holds(term.conditions, here, view);

  if (!isStarted) {
    const skipped = normalOf(here.value);
    const next = returning(skipped);
    return transitionOf(next, [], []);
  }

  const writes = startedOf(here.scope.activation, view);
  const next = evaluating(term.body, here);
  return transitionOf(next, [], writes);
}

function startedOf(address: Address, view: View): readonly Write[] {
  const cell = view.store.cellAt(address);
  const report: TaskReport = { name: "task.started", cell, details: {} };
  const event = taskEventOf(report, view);
  const start = reported(event);
  const phase = phaseChangedOf(address, "running", view);

  return [start, ...phase];
}
