import {
  type Completion,
  completionOf,
  isEnded,
} from "../completions/index.js";
import { afterItemOf } from "../evaluate/index.js";
import type { StreamK } from "../frames/index.js";
import { collectedOf } from "../streams/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToStream(
  frame: StreamK,
  completion: Completion,
  view: View,
): Transition {
  const collected = collectedOf(frame, completion.value);
  const ended = isEnded(completion);

  if (!ended) {
    return afterItemOf(collected, view);
  }

  const items = collected.consumption.items;
  const done = completionOf(items, completion.signal);
  const next = returning(done);

  return transitionOf(next, [], []);
}
