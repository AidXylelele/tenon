import type { Invoke } from "../../core/index.js";
import { invokeK } from "../frames/index.js";
import { procedurePathOf } from "../identity/index.js";
import {
  type Address,
  Environment,
  type Here,
  isWorkflowCell,
  scopeOf,
} from "../registers/index.js";
import {
  type Transition,
  evaluating,
  transitionOf,
} from "../transitions/index.js";
import { directReader, templateValueOf } from "../values/index.js";
import type { View } from "../view.js";

export function evaluateInvoke(
  term: Invoke,
  here: Here,
  view: View,
): Transition {
  const reader = directReader(here, view);
  const input = templateValueOf(term.arguments, here.value, reader);
  const task = term.callee.body;
  const workflow = workflowCellFrom(here.scope.activation, view);
  const path = procedurePathOf(here.scope.path, task.descriptor.reference);
  const scope = scopeOf(Environment.empty, workflow, path);
  const called: Here = { scope, value: input };
  const frames = [invokeK];
  const next = evaluating(task, called);

  return transitionOf(next, frames, []);
}

function workflowCellFrom(address: Address, view: View): Address {
  const cell = view.store.cellAt(address);
  const isWorkflow = isWorkflowCell(cell, address);

  if (isWorkflow) {
    return address;
  }

  return workflowCellFrom(cell.enclosing, view);
}
