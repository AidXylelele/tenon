import type { AsyncApiOutcome } from "../../api/index.js";
import type { Expression, Stop, Window } from "../../core/index.js";
import {
  type StreamK,
  type StreamWindow,
  openWindow,
  windowClosingAt,
} from "../frames/index.js";
import type { Here } from "../registers/index.js";
import { hasPassed } from "../time/index.js";
import { holds, instantOf } from "../values/index.js";
import type { View } from "../view.js";
import { type StopReader, isSatisfiedBy, strategyOf } from "./strategies.js";

export type Delivery = Extract<
  AsyncApiOutcome,
  { readonly kind: "message" | "closed" }
>;

interface PastWindow {
  readonly kind: "pastWindow";
}

type Windowed = Delivery | PastWindow;

const pastWindow: PastWindow = { kind: "pastWindow" };

export function streamWindowOf(
  stop: Stop,
  here: Here,
  view: View,
): StreamWindow {
  switch (stop.kind) {
    case "consumption":
      return openWindow;
    case "amount":
    case "while":
    case "until":
      return lifetimeWindowOf(stop.window, here, view);
  }
}

export function isStopped(frame: StreamK, view: View): boolean {
  const stop = frame.stream.stop;
  const consumed = frame.consumption.items.length;

  switch (stop.kind) {
    case "consumption": {
      const strategy = strategyOf(frame.stream.source);
      const reader = readerOf(frame, view);
      return isSatisfiedBy(strategy, frame.consumption, reader);
    }
    case "amount":
      return consumed >= stop.amount;
    case "while": {
      const isFirst = consumed === 0;

      if (isFirst) {
        return false;
      }

      const holding = holdsOnItems(stop.condition, frame, view);
      return !holding;
    }
    case "until":
      return holdsOnItems(stop.condition, frame, view);
  }
}

export function windowedOf(
  delivery: Delivery,
  window: StreamWindow,
  now: number,
): Windowed {
  switch (delivery.kind) {
    case "closed":
      return delivery;
    case "message": {
      const isClosed = isClosedAt(window, now);
      return isClosed ? pastWindow : delivery;
    }
  }
}

function lifetimeWindowOf(
  window: Window,
  here: Here,
  view: View,
): StreamWindow {
  switch (window.kind) {
    case "open":
      return openWindow;
    case "closesAfter": {
      const instant = instantOf(window.duration, here, view);
      return windowClosingAt(instant);
    }
  }
}

function isClosedAt(window: StreamWindow, now: number): boolean {
  switch (window.kind) {
    case "open":
      return false;
    case "closesAt":
      return hasPassed(window.instant, now);
  }
}

function readerOf(frame: StreamK, view: View): StopReader {
  return {
    holds: (condition) => holdsOnItems(condition, frame, view),
  };
}

function holdsOnItems(
  condition: Expression,
  frame: StreamK,
  view: View,
): boolean {
  const here: Here = { scope: frame.scope, value: frame.consumption.items };
  const conditions = [condition];

  return holds(conditions, here, view);
}
