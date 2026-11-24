import type {
  AttributeTest,
  CorrelationTemplate,
  Expression,
  FilterTemplate,
  Stop,
  StrategyTemplate,
  StreamSource,
  UntilCondition,
  UntilFirst,
  UntilStrategy,
  Window,
} from "../../forms/index.js";
import { asyncApiRequestExpressionsOf } from "./effects.js";
import { durationExpressionsOf, templatesExpressionsOf } from "./values.js";

const none: readonly Expression[] = [];

export function sourceExpressionsOf(
  source: StreamSource,
): readonly Expression[] {
  switch (source.kind) {
    case "listen":
      return strategyExpressionsOf(source.strategy);
    case "subscription": {
      const request = asyncApiRequestExpressionsOf(source.request);
      return [...request, ...source.filters];
    }
  }
}

export function stopExpressionsOf(stop: Stop): readonly Expression[] {
  switch (stop.kind) {
    case "consumption":
      return none;
    case "amount":
      return windowExpressionsOf(stop.window);
    case "while":
    case "until": {
      const window = windowExpressionsOf(stop.window);
      return [stop.condition, ...window];
    }
  }
}

function strategyExpressionsOf(
  strategy: StrategyTemplate,
): readonly Expression[] {
  switch (strategy.kind) {
    case "one":
      return filterExpressionsOf(strategy.filter);
    case "all":
      return strategy.filters.flatMap(filterExpressionsOf);
    case "any": {
      const filters = strategy.filters.flatMap(filterExpressionsOf);
      const until = untilExpressionsOf(strategy.until);
      return [...filters, ...until];
    }
  }
}

function untilExpressionsOf(
  until: UntilFirst | UntilCondition | UntilStrategy,
): readonly Expression[] {
  switch (until.kind) {
    case "first":
      return none;
    case "condition":
      return [until.condition];
    case "strategy":
      return strategyExpressionsOf(until.strategy);
  }
}

function filterExpressionsOf(filter: FilterTemplate): readonly Expression[] {
  const tests = [...filter.with.values()];
  const attributes = tests.flatMap(attributeExpressionsOf);
  const correlations = filter.correlate.flatMap(correlationExpressionsOf);

  return [...attributes, ...correlations];
}

function attributeExpressionsOf(test: AttributeTest): readonly Expression[] {
  switch (test.kind) {
    case "pattern":
    case "equals":
      return none;
    case "condition":
      return [test.condition];
  }
}

function correlationExpressionsOf(
  correlation: CorrelationTemplate,
): readonly Expression[] {
  const expect = correlation.expect;

  switch (expect.kind) {
    case "expected": {
      const expected = templatesExpressionsOf([expect.value]);
      return [correlation.from, ...expected];
    }
    case "firstSeen":
      return [correlation.from];
  }
}

function windowExpressionsOf(window: Window): readonly Expression[] {
  switch (window.kind) {
    case "open":
      return none;
    case "closesAfter":
      return durationExpressionsOf(window.duration);
  }
}
