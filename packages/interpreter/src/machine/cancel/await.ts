import type { AwaitK } from "../frames/index.js";
import { effectIdOf } from "../identity/index.js";
import {
  type Cancellation,
  cancellationOf,
  nothingCancelled,
  onward,
  withdrawn,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function cancelAwait(frame: AwaitK, view: View): Cancellation {
  const id = effectIdOf(frame.effect);
  const isAnswered = view.isAnswerHeld(id);

  if (isAnswered) {
    return nothingCancelled;
  }

  const withdrawal = withdrawn(id);
  const writes = [withdrawal];

  return cancellationOf(onward, writes);
}
