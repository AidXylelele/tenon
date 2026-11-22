import { type Completion, bypassOf } from "../completions/index.js";
import {
  type ExtensionPosition,
  beforeFrom,
  stepsFrom,
} from "../evaluate/index.js";
import type { BeforeK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import type { Transition } from "../transitions/index.js";

export function returnToBefore(
  frame: BeforeK,
  completion: Completion,
): Transition {
  const bypass = bypassOf(completion);

  if (bypass.kind === "bypass") {
    const bypassing = bypass.completion;
    const stages = [frame.extend.stages];
    const bypassed: Here = { scope: frame.scope, value: bypassing.value };
    return stepsFrom(stages, bypassing.signal, bypassed);
  }

  const at = frame.at + 1;
  const position: ExtensionPosition = {
    extend: frame.extend,
    applying: frame.applying,
    at,
  };
  const here: Here = { scope: frame.scope, value: frame.value };

  return beforeFrom(position, here, []);
}
