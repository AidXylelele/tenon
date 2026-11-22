import type { WorkflowK } from "../frames/index.js";
import { cancelledEnd, workflowEndedOf } from "../lifecycle/index.js";
import {
  type Cancellation,
  cancellationOf,
  cancelledRun,
  finishing,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function cancelWorkflow(frame: WorkflowK, view: View): Cancellation {
  const writes = workflowEndedOf(frame.activation, cancelledEnd, view);
  const next = finishing(cancelledRun);

  return cancellationOf(next, writes);
}
