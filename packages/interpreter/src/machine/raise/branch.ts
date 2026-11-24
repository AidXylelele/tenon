import type { JsonObject } from "../../api/index.js";
import type { BranchK } from "../frames/index.js";
import {
  type Transition,
  branchRaised,
  ending,
  transitionOf,
} from "../transitions/index.js";

export function raiseAtBranch(frame: BranchK, error: JsonObject): Transition {
  const report = branchRaised(frame.index, error);
  const next = ending(report);

  return transitionOf(next, [], []);
}
