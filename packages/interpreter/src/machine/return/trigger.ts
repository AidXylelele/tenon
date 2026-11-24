import type { Completion } from "../completions/index.js";
import { workflowRootOf } from "../evaluate/index.js";
import type { TriggerK } from "../frames/index.js";
import { workflowBegunOf } from "../lifecycle/index.js";
import {
  type Transition,
  startedOn,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToTrigger(
  frame: TriggerK,
  completion: Completion,
  view: View,
): Transition {
  const items = completion.value;
  const started = startedOn(items, view.context.now);
  const begun = workflowBegunOf(frame.activation, view);
  const writes = [started, ...begun];
  const root = workflowRootOf(view.program.root, frame.activation, items);
  const frames = [root.frame];

  return transitionOf(root.control, frames, writes);
}
