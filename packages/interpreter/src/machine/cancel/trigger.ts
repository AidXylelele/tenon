import type { TriggerK } from "../frames/index.js";
import {
  type Cancellation,
  cancellationOf,
  cancelledRun,
  finishing,
  freed,
} from "../transitions/index.js";

export function cancelTrigger(frame: TriggerK): Cancellation {
  const release = freed(frame.activation);
  const writes = [release];
  const next = finishing(cancelledRun);

  return cancellationOf(next, writes);
}
