import type { Sequence, Term } from "../../core/index.js";
import {
  type Signal,
  completionOf,
  normalSignal,
} from "../completions/index.js";
import { sequenceK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  evaluating,
  returning,
  transitionOf,
} from "../transitions/index.js";

export function evaluateSequence(term: Sequence, here: Here): Transition {
  return stepsFrom(term.steps, normalSignal, here);
}

export function stepsFrom(
  steps: readonly Term[],
  signal: Signal,
  here: Here,
): Transition {
  const step = steps[0];

  if (step === undefined) {
    const done = completionOf(here.value, signal);
    const next = returning(done);
    return transitionOf(next, [], []);
  }

  const rest = steps.slice(1);
  const next = evaluating(step, here);
  const isTail = rest.length === 0 && signal.kind === "normal";

  if (isTail) {
    return transitionOf(next, [], []);
  }

  const frame = sequenceK({ rest, signal, scope: here.scope });
  const frames = [frame];
  return transitionOf(next, frames, []);
}
