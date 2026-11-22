import type { Completion } from "../completions/index.js";
import type { BranchK } from "../frames/index.js";
import {
  type Transition,
  branchCompleted,
  ending,
  transitionOf,
} from "../transitions/index.js";

export function returnToBranch(
  frame: BranchK,
  completion: Completion,
): Transition {
  const report = branchCompleted(frame.index, completion);
  const next = ending(report);

  return transitionOf(next, [], []);
}
