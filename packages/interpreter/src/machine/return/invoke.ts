import { type Completion, returnedOf } from "../completions/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function returnToInvoke(completion: Completion): Transition {
  const returned = returnedOf(completion);
  const next = returning(returned);

  return transitionOf(next, [], []);
}
