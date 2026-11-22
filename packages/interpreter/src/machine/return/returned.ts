import { InterpreterError } from "../../runtime/index.js";
import type { Completion } from "../completions/index.js";
import type { Frame } from "../frames/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";
import { returnToAfter } from "./after.js";
import { returnToBefore } from "./before.js";
import { returnToBranch } from "./branch.js";
import { returnToExport } from "./export.js";
import { returnToInvoke } from "./invoke.js";
import { returnToLoop } from "./loop.js";
import { passedThrough } from "./pass.js";
import { returnToRetry } from "./retry.js";
import { returnToSequence } from "./sequence.js";
import { returnToStages } from "./stages.js";
import { returnToStreamItem } from "./stream-item.js";
import { returnToStream } from "./stream.js";
import { returnToTaskList } from "./task-list.js";
import { returnToTask } from "./task.js";
import { returnToTrigger } from "./trigger.js";
import { returnToValidate } from "./validate.js";
import { returnToWorkflow } from "./workflow.js";

export function returned(
  frame: Frame,
  completion: Completion,
  view: View,
): Transition {
  switch (frame.kind) {
    case "sequence":
      return returnToSequence(frame, completion);
    case "taskList":
      return returnToTaskList(frame, completion);
    case "task":
      return returnToTask(frame, completion, view);
    case "loop":
      return returnToLoop(frame, completion, view);
    case "invoke":
      return returnToInvoke(completion);
    case "workflow":
      return returnToWorkflow(frame, completion, view);
    case "validate":
      return returnToValidate(frame, completion, view);
    case "export":
      return returnToExport(frame, completion, view);
    case "deadline":
    case "handle":
      return passedThrough(completion);
    case "retry":
      return returnToRetry(frame, view);
    case "before":
      return returnToBefore(frame, completion);
    case "stages":
      return returnToStages(frame, completion);
    case "after":
      return returnToAfter(frame, completion);
    case "stream":
      return returnToStream(frame, completion, view);
    case "streamItem":
      return returnToStreamItem(frame, completion);
    case "await":
    case "receive":
      throw new InterpreterError(
        `The ${frame.kind} frame awaits an answer: it is never returned to.`,
      );
    case "trigger":
      return returnToTrigger(frame, completion, view);
    case "branch":
      return returnToBranch(frame, completion);
    case "join":
      throw new InterpreterError(
        "A fork's join is resumed by its branches' reports, never returned to.",
      );
  }
}
