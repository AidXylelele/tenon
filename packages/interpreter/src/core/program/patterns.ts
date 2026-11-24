import { InterpreterError, compiledPatternOf } from "../../runtime/index.js";
import {
  type FilterTemplate,
  type PatternTest,
  type StrategyTemplate,
  type Stream,
  type Term,
  listenStrategiesOf,
  placedFiltersOf,
} from "../forms/index.js";
import type { Keyed } from "./types.js";

const none: readonly PatternTest[] = [];

export function compiledPatternsOf(
  terms: readonly Term[],
): ReadonlyMap<string, RegExp> {
  const tests = terms.flatMap(heldPatternsOf);
  const compiled = tests.map(compiledEntryOf);

  return new Map(compiled);
}

function heldPatternsOf(term: Term): readonly PatternTest[] {
  switch (term.form) {
    case "stream":
      return streamPatternsOf(term);
    case "sequence":
    case "taskList":
    case "task":
    case "let":
    case "guard":
    case "transform":
    case "validate":
    case "export":
    case "choose":
    case "loop":
    case "perform":
    case "raise":
    case "handle":
    case "deadline":
    case "parallel":
    case "extend":
    case "invoke":
      return none;
  }
}

function streamPatternsOf(stream: Stream): readonly PatternTest[] {
  const strategies = listenStrategiesOf(stream);

  return strategies.flatMap(strategyPatternsOf);
}

function strategyPatternsOf(
  strategy: StrategyTemplate,
): readonly PatternTest[] {
  const placed = placedFiltersOf(strategy);
  return placed.flatMap(filterPatternsOf);
}

function filterPatternsOf(filter: FilterTemplate): readonly PatternTest[] {
  const tests = [...filter.with.values()];
  return tests.filter((test) => test.kind === "pattern");
}

function compiledEntryOf(test: PatternTest): Keyed<RegExp> {
  const compiled = compiledPatternOf(test.pattern);

  if (compiled === null) {
    throw new InterpreterError(
      `The pattern '${test.id}' is no regular expression: '${test.pattern}'.`,
    );
  }

  return [test.id, compiled];
}
