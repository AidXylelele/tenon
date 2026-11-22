import type { TaskK } from "../frames/index.js";
import { cancelledEnd, taskEndedOf } from "../lifecycle/index.js";
import {
  type Cancellation,
  cancellationOf,
  onward,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function cancelTask(frame: TaskK, view: View): Cancellation {
  const writes = taskEndedOf(frame.activation, cancelledEnd, view);

  return cancellationOf(onward, writes);
}
