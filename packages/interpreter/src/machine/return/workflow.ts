import type { Completion } from "../completions/index.js";
import type { WorkflowK } from "../frames/index.js";
import { completedEnd, workflowEndedOf } from "../lifecycle/index.js";
import {
  type Transition,
  completedWith,
  finishing,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToWorkflow(
  frame: WorkflowK,
  completion: Completion,
  view: View,
): Transition {
  const writes = workflowEndedOf(frame.activation, completedEnd, view);
  const result = completedWith(completion.value);
  const next = finishing(result);

  return transitionOf(next, [], writes);
}
