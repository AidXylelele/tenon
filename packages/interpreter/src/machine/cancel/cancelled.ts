import type { Frame } from "../frames/index.js";
import {
  type Cancellation,
  branchGone,
  nothingCancelled,
} from "../transitions/index.js";
import type { View } from "../view.js";
import { cancelAwait } from "./await.js";
import { cancelJoin } from "./join.js";
import { cancelReceive } from "./receive.js";
import { cancelTask } from "./task.js";
import { cancelTrigger } from "./trigger.js";
import { cancelWorkflow } from "./workflow.js";

export function cancelled(frame: Frame, view: View): Cancellation {
  switch (frame.kind) {
    case "task":
      return cancelTask(frame, view);
    case "await":
      return cancelAwait(frame, view);
    case "receive":
      return cancelReceive(frame);
    case "workflow":
      return cancelWorkflow(frame, view);
    case "trigger":
      return cancelTrigger(frame);
    case "join":
      return cancelJoin(frame);
    case "branch":
      return branchGone;
    case "sequence":
    case "taskList":
    case "validate":
    case "export":
    case "loop":
    case "handle":
    case "retry":
    case "deadline":
    case "stream":
    case "streamItem":
    case "before":
    case "stages":
    case "after":
    case "invoke":
      return nothingCancelled;
  }
}
