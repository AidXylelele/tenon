import { type Completion, isEnded } from "../completions/index.js";
import { type LoopPosition, iterationOf } from "../evaluate/index.js";
import type { LoopK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToLoop(
  frame: LoopK,
  completion: Completion,
  view: View,
): Transition {
  const ended = isEnded(completion);

  if (ended) {
    const next = returning(completion);
    return transitionOf(next, [], []);
  }

  const index = frame.index + 1;
  const position: LoopPosition = {
    loop: frame.loop,
    items: frame.items,
    index,
  };
  const here: Here = { scope: frame.scope, value: completion.value };

  return iterationOf(position, here, view);
}
