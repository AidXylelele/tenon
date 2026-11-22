import type { Parallel } from "../../core/index.js";
import { normalOf } from "../completions/index.js";
import { joinK, pendingBranch } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  evaluating,
  forking,
  returning,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function evaluateParallel(
  term: Parallel,
  here: Here,
  view: View,
): Transition {
  const isEmpty = term.branches.length === 0;

  if (isEmpty) {
    const joined = normalOf([]);
    const next = returning(joined);
    return transitionOf(next, [], []);
  }

  const branches = term.branches.map((branch) => evaluating(branch, here));
  const fibers = term.branches.map((_branch, index) => view.nextFiber + index);
  const outputs = term.branches.map(() => pendingBranch);
  const frame = joinK({ parallel: term, branches: fibers, outputs });
  const frames = [frame];
  const next = forking(branches);

  return transitionOf(next, frames, []);
}
