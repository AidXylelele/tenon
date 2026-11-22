import type { Completion } from "../completions/index.js";
import type { ExtensionPosition } from "../evaluate/index.js";
import type { StagesK } from "../frames/index.js";
import type { Transition } from "../transitions/index.js";
import { afterFrom } from "./after.js";

export function returnToStages(
  frame: StagesK,
  completion: Completion,
): Transition {
  const at = frame.applying.length - 1;
  const position: ExtensionPosition = {
    extend: frame.extend,
    applying: frame.applying,
    at,
  };

  return afterFrom(position, completion, frame.scope);
}
