import type { JsonObject } from "../../api/index.js";
import { placedAt } from "../../runtime/index.js";
import type { TaskK } from "../frames/index.js";
import { faultedEnd, taskEndedOf } from "../lifecycle/index.js";
import {
  type Transition,
  raising,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function raiseAtTask(
  frame: TaskK,
  error: JsonObject,
  view: View,
): Transition {
  const placed = placedAt(error, frame.task.descriptor.reference);
  const end = faultedEnd(placed);
  const writes = taskEndedOf(frame.activation, end, view);
  const next = raising(placed);

  return transitionOf(next, [], writes);
}
