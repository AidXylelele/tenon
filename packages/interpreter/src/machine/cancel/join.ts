import { pendingFibersOf } from "../fibers/index.js";
import type { JoinK } from "../frames/index.js";
import {
  type Cancellation,
  cancellationOf,
  onwardAfter,
} from "../transitions/index.js";

export function cancelJoin(frame: JoinK): Cancellation {
  const fibers = pendingFibersOf(frame);

  const next = onwardAfter(fibers);

  return cancellationOf(next, []);
}
