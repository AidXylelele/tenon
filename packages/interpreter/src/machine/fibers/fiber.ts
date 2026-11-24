import type { Stack } from "immutable";
import type { Frame } from "../frames/index.js";
import type { FiberId } from "../registers/index.js";

export interface Fiber {
  readonly id: FiberId;
  readonly parent: FiberId | "root";
  readonly continuation: Stack<Frame>;
}

export function fiberOf(
  id: FiberId,
  parent: Fiber["parent"],
  continuation: Stack<Frame>,
): Fiber {
  return { id, parent, continuation };
}
