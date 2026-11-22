import { InterpreterError } from "../../runtime/index.js";
import type { Frame } from "../frames/index.js";
import type { Fiber } from "./fiber.js";

export function topFrameOf(fiber: Fiber): Frame {
  const top = fiber.continuation.peek();

  if (top === undefined) {
    throw new InterpreterError(
      `The fiber ${String(fiber.id)} has no frame to return to.`,
    );
  }

  return top;
}
