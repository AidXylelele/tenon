import { InterpreterError } from "../../runtime/index.js";
import type { Frame } from "../frames/index.js";
import { timeoutOf } from "../time/index.js";
import {
  type Cancellation,
  type Finishing,
  type Gone,
  type Interrupting,
  type Next,
  type Stop,
  type Transition,
  raising,
  transitionOf,
  unwinding,
} from "../transitions/index.js";
import type { View } from "../view.js";
import { cancelled } from "./cancelled.js";

export interface InterruptedFrame {
  readonly frame: Frame;
  readonly depth: number;
}

export function interrupted(
  popped: InterruptedFrame,
  control: Interrupting,
  view: View,
): Transition {
  const isOwner = isOwnerAt(control.stop, popped.depth);

  if (isOwner) {
    return expiredAt(popped.frame);
  }

  const cancellation = cancelled(popped.frame, view);
  const next = unwoundPast(control, cancellation);

  return transitionOf(next, [], cancellation.writes);
}

function isOwnerAt(stop: Stop, depth: number): boolean {
  switch (stop.kind) {
    case "bottom":
      return false;
    case "deadline":
      return stop.depth === depth;
  }
}

function expiredAt(frame: Frame): Transition {
  if (frame.kind !== "deadline") {
    throw new InterpreterError(
      `An interruption stops at its owner's deadline, not at the ${frame.kind} frame.`,
    );
  }

  const timeout = timeoutOf();
  const next = raising(timeout.error);

  return transitionOf(next, [], []);
}

function unwoundPast(control: Interrupting, cancellation: Cancellation): Next {
  const next = cancellation.next;

  switch (next.kind) {
    case "onward":
      return control;
    case "after":
      return unwinding(next.fibers, control);
    case "finish":
    case "gone":
      return bottomUnder(control.stop, next);
  }
}

function bottomUnder(stop: Stop, bottom: Finishing | Gone): Finishing | Gone {
  switch (stop.kind) {
    case "bottom":
      return bottom;
    case "deadline":
      throw new InterpreterError(
        "An interruption reached the bottom of its fiber and met no owner.",
      );
  }
}
