import type { JsonObject } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import type { Frame } from "../frames/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";
import { raiseAtBranch } from "./branch.js";
import { raiseAtHandle } from "./handle.js";
import { passedOn } from "./pass.js";
import { raiseAtTask } from "./task.js";
import { raiseAtTrigger } from "./trigger.js";
import { raiseAtWorkflow } from "./workflow.js";

export function raised(
  frame: Frame,
  error: JsonObject,
  view: View,
): Transition {
  switch (frame.kind) {
    case "task":
      return raiseAtTask(frame, error, view);
    case "workflow":
      return raiseAtWorkflow(frame, error, view);
    case "handle":
      return raiseAtHandle(frame, error, view);
    case "sequence":
    case "taskList":
    case "validate":
    case "export":
    case "loop":
    case "retry":
    case "deadline":
    case "stream":
    case "streamItem":
    case "before":
    case "stages":
    case "after":
    case "invoke":
      return passedOn(error);
    case "trigger":
      return raiseAtTrigger(frame, error);
    case "branch":
      return raiseAtBranch(frame, error);
    case "await":
    case "receive":
      throw new InterpreterError(
        `The ${frame.kind} frame awaits an answer: it is never raised to.`,
      );
    case "join":
      throw new InterpreterError(
        "A fork's join is resumed by its branches' reports, never raised to.",
      );
  }
}
