import type * as ast from "../../syntax/index.js";
import {
  type AnyStrategy,
  type AttributeTest,
  type CorrelationTemplate,
  type Expected,
  type FilterAt,
  type FilterTemplate,
  type FirstSeen,
  type StrategyTemplate,
  allStrategy,
  anyStrategy,
  conditionTest,
  equalsTest,
  expected,
  filterTemplate,
  firstSeen,
  oneStrategy,
  patternTest,
  untilCondition,
  untilFirst,
  untilStrategy,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { addressedExpressionOf } from "./expressions.js";
import { writtenTemplateOf } from "./templates.js";

export function strategyTemplateOf(
  strategy: ast.ConsumptionStrategy,
  context: Context,
): StrategyTemplate {
  return strategyAt(strategy, 0, context);
}

function strategyAt(
  strategy: ast.ConsumptionStrategy,
  level: number,
  context: Context,
): StrategyTemplate {
  switch (strategy.kind) {
    case "one": {
      const at: FilterAt = { level, filter: 0 };
      const filter = filterOf(strategy.filter, at, context);
      return oneStrategy({ filter });
    }
    case "all": {
      const filters = filtersAt(strategy.filters, level, context);
      return allStrategy({ filters });
    }
    case "any":
      return anyStrategyAt(strategy, level, context);
  }
}

function anyStrategyAt(
  strategy: ast.AnyEventConsumption,
  level: number,
  context: Context,
): AnyStrategy {
  const filters = anyFiltersAt(strategy.filters, level, context);
  const until = untilAt(strategy.until, level, context);

  return anyStrategy({ filters, until });
}

function anyFiltersAt(
  filters: readonly ast.EventFilter[],
  level: number,
  context: Context,
): readonly FilterTemplate[] {
  const isWritten = filters.length > 0;

  if (isWritten) {
    return filtersAt(filters, level, context);
  }

  const at: FilterAt = { level, filter: 0 };
  const tests = new Map<string, AttributeTest>();
  const everyEvent = filterTemplate({ at, with: tests, correlate: [] });

  return [everyEvent];
}

function untilAt(
  until: ast.Expression | ast.ConsumptionStrategy | null,
  level: number,
  context: Context,
): AnyStrategy["until"] {
  if (until === null) {
    return untilFirst;
  }

  switch (until.kind) {
    case "expression": {
      const condition = addressedExpressionOf(until, context);
      return untilCondition({ condition });
    }
    case "all":
    case "any":
    case "one": {
      const below = level + 1;
      const strategy = strategyAt(until, below, context);
      return untilStrategy({ strategy });
    }
  }
}

function filtersAt(
  filters: readonly ast.EventFilter[],
  level: number,
  context: Context,
): readonly FilterTemplate[] {
  return filters.map((filter, index) => {
    const at: FilterAt = { level, filter: index };
    return filterOf(filter, at, context);
  });
}

function filterOf(
  filter: ast.EventFilter,
  at: FilterAt,
  context: Context,
): FilterTemplate {
  const written = [...filter.with.attributes];
  const attributes = written.map(([name, attribute]) => {
    const test = attributeTestOf(attribute, context);
    return [name, test] as const;
  });
  const tests = new Map(attributes);
  const correlate = correlationsOf(filter.correlate, context);

  return filterTemplate({ at, with: tests, correlate });
}

function attributeTestOf(
  attribute: ast.FilterAttribute,
  context: Context,
): AttributeTest {
  switch (attribute.kind) {
    case "pattern":
      return patternTest({ id: attribute.pointer, pattern: attribute.pattern });
    case "condition": {
      const condition = addressedExpressionOf(attribute.condition, context);
      return conditionTest({ condition });
    }
    case "value":
      return equalsTest({ value: attribute.value });
  }
}

function correlationsOf(
  correlate: ReadonlyMap<string, ast.Correlation>,
  context: Context,
): readonly CorrelationTemplate[] {
  const written = [...correlate];

  return written.map(([key, correlation]) =>
    correlationOf(key, correlation, context),
  );
}

function correlationOf(
  key: string,
  correlation: ast.Correlation,
  context: Context,
): CorrelationTemplate {
  const from = addressedExpressionOf(correlation.from, context);
  const expect = expectationOf(correlation.expect, context);

  return { key, from, expect };
}

function expectationOf(
  expect: ast.TextTemplate | null,
  context: Context,
): Expected | FirstSeen {
  if (expect === null) {
    return firstSeen;
  }

  const value = writtenTemplateOf(expect, context);
  return expected({ value });
}
