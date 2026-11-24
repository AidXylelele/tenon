import type { Completion } from "../completions/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function passedThrough(completion: Completion): Transition {
  const next = returning(completion);

  return transitionOf(next, [], []);
}
