import { type Completion, isEnded } from "../completions/index.js";
import {
  type StreamItemK,
  streamItemK,
  streamItemOf,
} from "../frames/index.js";
import { iteratorEnteredOf } from "../streams/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function returnToStreamItem(
  frame: StreamItemK,
  completion: Completion,
): Transition {
  const ended = isEnded(completion);
  const index = frame.iterator + 1;
  const iterator = frame.stream.iterators[index];
  const isLast = iterator === undefined;

  const isDone = ended || isLast;

  if (isDone) {
    const next = returning(completion);
    return transitionOf(next, [], []);
  }

  const item = streamItemOf(completion.value, frame.item.index);
  const following = streamItemK({
    stream: frame.stream,
    iterator: index,
    item,
    scope: frame.scope,
  });
  const next = iteratorEnteredOf(following, iterator);
  const frames = [following];

  return transitionOf(next, frames, []);
}
