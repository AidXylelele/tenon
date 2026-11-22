import type { EffectOutcome } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import type { Frame } from "../frames/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";
import { respondToAwait } from "./await.js";
import { respondToReceive } from "./receive.js";

export function responded(
  frame: Frame,
  outcome: EffectOutcome,
  view: View,
): Transition {
  switch (frame.kind) {
    case "await":
      return respondToAwait(frame, outcome, view);
    case "receive":
      return respondToReceive(frame, outcome, view);
    case "sequence":
    case "taskList":
    case "task":
    case "validate":
    case "export":
    case "loop":
    case "handle":
    case "retry":
    case "deadline":
    case "join":
    case "branch":
    case "stream":
    case "streamItem":
    case "before":
    case "stages":
    case "after":
    case "invoke":
    case "workflow":
    case "trigger":
      throw new InterpreterError(`The ${frame.kind} frame awaits no response.`);
  }
}
