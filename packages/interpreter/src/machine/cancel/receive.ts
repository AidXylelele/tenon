import type { ReceiveK } from "../frames/index.js";
import { itemWithdrawnOf } from "../streams/index.js";
import {
  type Cancellation,
  cancellationOf,
  onward,
} from "../transitions/index.js";

export function cancelReceive(frame: ReceiveK): Cancellation {
  const withdrawal = itemWithdrawnOf(frame);
  const writes = [withdrawal];

  return cancellationOf(onward, writes);
}
