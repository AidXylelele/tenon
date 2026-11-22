import type { JsonObject, JsonValue } from "../../api/index.js";
import type {
  CorrelationTemplate,
  FilterAt,
  FilterTemplate,
} from "../../core/index.js";
import { InterpreterError, isJsonEqual } from "../../runtime/index.js";
import {
  type Expectation,
  type StreamFrame,
  type StreamK,
  expectationOf,
} from "../frames/index.js";
import {
  correlationCompletedOf,
  correlationStartedOf,
} from "../lifecycle/index.js";
import type { Here } from "../registers/index.js";
import { type Write, reported } from "../transitions/index.js";
import {
  type TemplateReader,
  directReader,
  expressionValueOf,
  templateValueOf,
} from "../values/index.js";
import type { View } from "../view.js";
import {
  type Correlating,
  type Match,
  type Standing,
  refused,
} from "./types.js";

interface Prior {
  readonly keys: JsonObject;
  readonly correlating: Correlating;
}

interface Extracted {
  readonly value: JsonValue;
  readonly keys: JsonObject;
  readonly at: FilterAt;
}

interface Reading {
  readonly input: JsonValue;
  readonly reader: TemplateReader;
}

export function expectationsOf(
  filters: readonly FilterTemplate[],
  here: Here,
  view: View,
): readonly Expectation[] {
  const reader = directReader(here, view);
  const reading: Reading = { input: here.value, reader };

  return filters.flatMap((filter) => filterExpectationsOf(filter, reading));
}

export function correlatedOf(
  correlating: Correlating,
  standing: Standing,
): Match {
  const correlations = correlating.filter.correlate;
  const keys = standing.frame.consumption.keys;
  const start = matchedWith(keys);

  return correlations.reduce((match, correlation) => {
    if (match.kind === "refused") {
      return match;
    }

    const prior: Prior = { keys: match.keys, correlating };
    return keyedOf(correlation, prior, standing);
  }, start);
}

export function correlationStartOf(
  frame: StreamK,
  view: View,
): readonly Write[] {
  const correlates = view.statics.correlating.has(frame.stream);

  if (!correlates) {
    return [];
  }

  const event = correlationStartedOf(view);
  const start = reported(event);
  return [start];
}

export function correlationEndOf(
  frame: StreamFrame,
  view: View,
): readonly Write[] {
  const correlates = view.statics.correlating.has(frame.stream);

  if (!correlates) {
    return [];
  }

  const keys = frame.consumption.keys;
  const event = correlationCompletedOf(keys, view);
  const end = reported(event);
  return [end];
}

function filterExpectationsOf(
  filter: FilterTemplate,
  reading: Reading,
): readonly Expectation[] {
  const correlations = filter.correlate;

  return correlations.flatMap((correlation) =>
    expectedBy(correlation, filter.at, reading),
  );
}

function expectedBy(
  correlation: CorrelationTemplate,
  at: FilterAt,
  reading: Reading,
): readonly Expectation[] {
  const expect = correlation.expect;

  switch (expect.kind) {
    case "firstSeen":
      return [];
    case "expected": {
      const value = templateValueOf(
        expect.value,
        reading.input,
        reading.reader,
      );
      const expectation = expectationOf({
        level: at.level,
        filter: at.filter,
        correlation: correlation.key,
        value,
      });
      return [expectation];
    }
  }
}

function keyedOf(
  correlation: CorrelationTemplate,
  prior: Prior,
  standing: Standing,
): Match {
  const correlating = prior.correlating;
  const here: Here = { scope: standing.frame.scope, value: correlating.event };
  const value = expressionValueOf(correlation.from, here, standing.view);

  if (value === null) {
    return refused;
  }

  const at = correlating.filter.at;
  const extracted: Extracted = { value, keys: prior.keys, at };
  const expected = isExpected(correlation, extracted, standing);

  if (!expected) {
    return refused;
  }

  const keys = { ...prior.keys, [correlation.key]: value };
  return matchedWith(keys);
}

function isExpected(
  correlation: CorrelationTemplate,
  extracted: Extracted,
  standing: Standing,
): boolean {
  const expect = correlation.expect;

  switch (expect.kind) {
    case "expected": {
      const expected = standing.frame.consumption.expected;
      const expectation = expectationAt(correlation, extracted.at, expected);
      return isJsonEqual(expectation.value, extracted.value);
    }
    case "firstSeen":
      return isFixedTo(correlation.key, extracted);
  }
}

function expectationAt(
  correlation: CorrelationTemplate,
  at: FilterAt,
  expected: readonly Expectation[],
): Expectation {
  const found = expected.find((expectation) =>
    isExpectationAt(expectation, correlation, at),
  );

  if (found === undefined) {
    throw new InterpreterError(
      `The stream expects no value of '${correlation.key}' at level ${String(at.level)}, filter ${String(at.filter)}.`,
    );
  }

  return found;
}

function isExpectationAt(
  expectation: Expectation,
  correlation: CorrelationTemplate,
  at: FilterAt,
): boolean {
  const isFilter =
    expectation.level === at.level && expectation.filter === at.filter;
  const isKey = expectation.correlation === correlation.key;
  const isExpected = isFilter && isKey;

  return isExpected;
}

function isFixedTo(key: string, extracted: Extracted): boolean {
  const keys = extracted.keys;
  const fixed = Object.hasOwn(keys, key);

  if (!fixed) {
    return true;
  }

  const value = keys[key] ?? null;
  return isJsonEqual(value, extracted.value);
}

function matchedWith(keys: JsonObject): Match {
  return { kind: "matched", keys };
}
