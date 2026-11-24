import { type Completion, directedOf } from "../completions/index.js";
import type { TaskK } from "../frames/index.js";
import {
  completedEnd,
  outputGivenOf,
  taskEndedOf,
} from "../lifecycle/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToTask(
  frame: TaskK,
  completion: Completion,
  view: View,
): Transition {
  const given = outputGivenOf(frame.activation, completion.value, view);
  const ended = taskEndedOf(frame.activation, completedEnd, view);
  const writes = [given, ...ended];
  const directed = directedOf(frame.task.then, completion);
  const next = returning(directed);

  return transitionOf(next, [], writes);
}
