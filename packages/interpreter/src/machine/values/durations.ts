import type { JsonValue } from "../../api/index.js";
import type {
  ComputedDuration,
  DurationTerm,
  Expression,
} from "../../core/index.js";
import {
  Raised,
  fixedMillisecondsOf,
  hasCalendarUnits,
  instantAfterTextOf,
  temporalDurationOf,
} from "../../runtime/index.js";
import type { Here } from "../registers/index.js";
import type { View } from "../view.js";
import {
  type RequestValues,
  evaluatedValueOf,
  expressionValueOf,
} from "./expressions.js";
import { shownValueOf } from "./secret-reads.js";

interface Timing {
  readonly now: number;
  computed(expression: Expression): JsonValue;
}

export function instantOf(
  duration: DurationTerm,
  here: Here,
  view: View,
): number {
  const timing: Timing = {
    now: view.context.now,
    computed: (expression) => expressionValueOf(expression, here, view),
  };

  return instantTimedOf(duration, timing);
}

export function millisecondsOf(
  duration: DurationTerm,
  here: Here,
  view: View,
): number {
  const instant = instantOf(duration, here, view);
  return instant - view.context.now;
}

export function requestInstantOf(
  duration: DurationTerm,
  values: RequestValues,
  view: View,
): number {
  const timing: Timing = {
    now: view.context.now,
    computed: (expression) => evaluatedValueOf(values, expression),
  };

  return instantTimedOf(duration, timing);
}

export function requestLengthOf(
  duration: DurationTerm,
  values: RequestValues,
): number {
  switch (duration.kind) {
    case "fixed":
      return duration.milliseconds;
    case "calendar":
      throw notFixedOf(duration, duration.iso);
    case "computed": {
      const computed = evaluatedValueOf(values, duration.expression);
      return fixedLengthOf(duration, computed);
    }
  }
}

function fixedLengthOf(term: ComputedDuration, computed: JsonValue): number {
  const isText = typeof computed === "string";

  if (!isText) {
    throw noDurationOf(term, computed);
  }

  const duration = temporalDurationOf(computed);

  if (duration === null) {
    throw noDurationOf(term, computed);
  }

  const isCalendar = hasCalendarUnits(duration);

  if (isCalendar) {
    throw notFixedOf(term, computed);
  }

  return fixedMillisecondsOf(duration);
}

function instantTimedOf(duration: DurationTerm, timing: Timing): number {
  switch (duration.kind) {
    case "fixed":
      return timing.now + duration.milliseconds;
    case "calendar":
      return instantAfterOf(duration, duration.iso, timing);
    case "computed":
      return computedInstantOf(duration, timing);
  }
}

function computedInstantOf(duration: ComputedDuration, timing: Timing): number {
  const computed = timing.computed(duration.expression);
  const isText = typeof computed === "string";

  if (!isText) {
    throw noDurationOf(duration, computed);
  }

  return instantAfterOf(duration, computed, timing);
}

function instantAfterOf(
  duration: DurationTerm,
  text: string,
  timing: Timing,
): number {
  const instant = instantAfterTextOf(timing.now, text);

  if (instant === null) {
    throw noDurationOf(duration, text);
  }

  return instant;
}

function noDurationOf(duration: DurationTerm, value: JsonValue): Raised {
  const shown = shownDurationOf(duration, value);
  const detail = `${shown} is no ISO 8601 duration.`;

  return Raised.standard("configuration", detail);
}

function notFixedOf(duration: DurationTerm, value: JsonValue): Raised {
  const shown = shownDurationOf(duration, value);
  const detail = `${shown} has no fixed length: it has years, months or weeks.`;

  return Raised.standard("configuration", detail);
}

function shownDurationOf(duration: DurationTerm, value: JsonValue): string {
  switch (duration.kind) {
    case "computed":
      return shownValueOf(duration.expression, value);
    case "fixed":
    case "calendar":
      return JSON.stringify(value);
  }
}
