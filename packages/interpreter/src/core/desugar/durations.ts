import { InterpreterError } from "../../runtime/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type ComputedDuration,
  type DurationTerm,
  calendarDuration,
  computedDuration,
  fixedDuration,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { addressedExpressionOf } from "./expressions.js";

export function durationOf(
  duration: ast.Duration,
  context: Context,
): DurationTerm {
  switch (duration.kind) {
    case "fixed":
      return fixedDuration({ milliseconds: duration.milliseconds });
    case "calendar":
      return calendarDuration({ iso: duration.iso });
    case "computed":
      return computedDurationOf(duration, context);
    case "invalid":
      throw new InterpreterError(
        `The duration '${duration.text}' at '${duration.pointer}' does not read.`,
      );
  }
}

function computedDurationOf(
  duration: ast.ComputedDuration,
  context: Context,
): ComputedDuration {
  const expression = addressedExpressionOf(duration.expression, context);
  return computedDuration({ expression });
}
