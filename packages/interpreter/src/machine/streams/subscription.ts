import type { JsonValue } from "../../api/index.js";
import type { Expression, StreamSource } from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import type { ReceiveK, StreamK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import { type RequestValues, heldValuesOf, holds } from "../values/index.js";
import type { View } from "../view.js";

const noValues: RequestValues = new Map();

export function sourceValuesOf(
  source: StreamSource,
  here: Here,
  view: View,
): RequestValues {
  switch (source.kind) {
    case "listen":
      return noValues;
    case "subscription":
      return heldValuesOf(source, here, view);
  }
}

export function nextValuesOf(frame: StreamK, view: View): RequestValues {
  const here: Here = { scope: frame.scope, value: frame.input };

  return sourceValuesOf(frame.stream.source, here, view);
}

export function isAccepted(
  frame: ReceiveK,
  message: JsonValue,
  view: View,
): boolean {
  const filters = filtersOf(frame.stream.source);
  const here: Here = { scope: frame.scope, value: message };

  return holds(filters, here, view);
}

function filtersOf(source: StreamSource): readonly Expression[] {
  switch (source.kind) {
    case "listen":
      throw new InterpreterError(
        "A listen is offered events, never a message.",
      );
    case "subscription":
      return source.filters;
  }
}
