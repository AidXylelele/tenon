import type { JsonObject } from "../../api/index.js";
import { placedAt, rootPointer } from "../../runtime/index.js";
import type { WorkflowK } from "../frames/index.js";
import { faultedEnd, workflowEndedOf } from "../lifecycle/index.js";
import {
  type Transition,
  faultedWith,
  finishing,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function raiseAtWorkflow(
  frame: WorkflowK,
  error: JsonObject,
  view: View,
): Transition {
  const placed = placedAt(error, rootPointer);
  const end = faultedEnd(placed);
  const writes = workflowEndedOf(frame.activation, end, view);
  const result = faultedWith(placed);
  const next = finishing(result);

  return transitionOf(next, [], writes);
}
