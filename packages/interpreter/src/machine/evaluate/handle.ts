import type { Handle } from "../../core/index.js";
import type { Here } from "../registers/index.js";
import {
  type AttemptStart,
  attemptEnteredOf,
  firstAttemptOf,
} from "../retry/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";

export function evaluateHandle(
  term: Handle,
  here: Here,
  view: View,
): Transition {
  const attempt = firstAttemptOf(here, view);
  const start: AttemptStart = { handle: term, attempt, here };

  return attemptEnteredOf(start, view);
}
