import type { RetryK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import { type AttemptStart, attemptEnteredOf } from "../retry/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToRetry(frame: RetryK, view: View): Transition {
  const here: Here = { scope: frame.scope, value: frame.attempt.input };
  const start: AttemptStart = {
    handle: frame.handle,
    attempt: frame.attempt,
    here,
  };

  return attemptEnteredOf(start, view);
}
