import { type Completion, closedOf } from "../completions/index.js";
import { type ExtensionPosition, listEnteredOf } from "../evaluate/index.js";
import { type AfterK, afterK } from "../frames/index.js";
import type { Here, Scope } from "../registers/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function returnToAfter(
  frame: AfterK,
  completion: Completion,
): Transition {
  const closed = closedOf(frame.completion, completion);
  const position = previousOf(frame);

  return afterFrom(position, closed, frame.scope);
}

export function afterFrom(
  position: ExtensionPosition,
  completion: Completion,
  scope: Scope,
): Transition {
  const isPast = position.at < 0;

  if (isPast) {
    const next = returning(completion);
    return transitionOf(next, [], []);
  }

  const here: Here = { scope, value: completion.value };
  const entry = listEnteredOf(position, "after", here);

  switch (entry.kind) {
    case "none": {
      const previous = previousOf(position);
      return afterFrom(previous, completion, scope);
    }
    case "entered": {
      const frame = afterK({
        extend: position.extend,
        applying: position.applying,
        at: position.at,
        completion,
        scope,
      });
      const frames = [frame];
      return transitionOf(entry.evaluating, frames, []);
    }
  }
}

function previousOf(position: ExtensionPosition): ExtensionPosition {
  const at = position.at - 1;

  return { extend: position.extend, applying: position.applying, at };
}
