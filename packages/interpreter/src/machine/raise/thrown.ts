import type { JsonObject } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import {
  type Control,
  type Transition,
  raising,
  transitionOf,
} from "../transitions/index.js";

export function raisedFromRule(
  control: Control,
  error: JsonObject,
): Transition {
  switch (control.kind) {
    case "evaluate":
    case "return":
    case "raise":
    case "respond": {
      const next = raising(error);
      return transitionOf(next, [], []);
    }
    case "interrupt":
      throw new InterpreterError(
        "A cancel rule raised a workflow error: no handler catches an interruption.",
      );
  }
}
