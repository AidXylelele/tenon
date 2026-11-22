import { type Completion, sequencedSignalOf } from "../completions/index.js";
import { stepsFrom } from "../evaluate/index.js";
import type { SequenceK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import type { Transition } from "../transitions/index.js";

export function returnToSequence(
  frame: SequenceK,
  completion: Completion,
): Transition {
  const signal = sequencedSignalOf(frame.signal, completion.signal);
  const here: Here = { scope: frame.scope, value: completion.value };

  return stepsFrom(frame.rest, signal, here);
}
