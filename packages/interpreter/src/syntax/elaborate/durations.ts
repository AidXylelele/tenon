import {
  fixedMillisecondsOf,
  hasCalendarUnits,
  temporalDurationOf,
} from "../../runtime/index.js";
import type { Duration } from "../ast/index.js";
import { optionalAt } from "./parts.js";
import { numberOf } from "./scalars.js";
import type { Part } from "./types.js";
import { embeddedExpressionOf } from "./values.js";

export function durationOf(part: Part): Duration {
  const value = part.value;

  if (typeof value !== "string") {
    return inlineDurationOf(part);
  }

  const expression = embeddedExpressionOf(part.pointer, value);

  if (expression === null) {
    return isoDurationOf(part, value);
  }

  return { kind: "computed", pointer: part.pointer, expression };
}

function isoDurationOf(part: Part, iso: string): Duration {
  const duration = temporalDurationOf(iso);

  if (duration === null) {
    return { kind: "invalid", pointer: part.pointer, text: iso };
  }

  const isCalendar = hasCalendarUnits(duration);

  if (isCalendar) {
    return { kind: "calendar", pointer: part.pointer, iso };
  }

  const milliseconds = fixedMillisecondsOf(duration);
  return { kind: "fixed", pointer: part.pointer, milliseconds };
}

function inlineDurationOf(part: Part): Duration {
  const units = {
    days: unitOf(part, "days"),
    hours: unitOf(part, "hours"),
    minutes: unitOf(part, "minutes"),
    seconds: unitOf(part, "seconds"),
    milliseconds: unitOf(part, "milliseconds"),
  };
  const duration = temporalDurationOf(units);

  if (duration === null) {
    const text = JSON.stringify(part.value);
    return { kind: "invalid", pointer: part.pointer, text };
  }

  const milliseconds = fixedMillisecondsOf(duration);
  return { kind: "fixed", pointer: part.pointer, milliseconds };
}

function unitOf(part: Part, unit: string): number {
  return optionalAt(part, unit, numberOf) ?? 0;
}
