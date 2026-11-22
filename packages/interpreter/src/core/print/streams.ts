import {
  type AnyStrategy,
  type AttributeTest,
  type CorrelationTemplate,
  type FilterTemplate,
  type Iterator,
  type Stop,
  type StrategyTemplate,
  type StreamSource,
  type Window,
  levelFiltersOf,
} from "../forms/index.js";
import { asyncApiRequestLinesOf } from "./effects.js";
import { groupOf, labelledOf, leafOf, lineOf, type Line } from "./line.js";
import {
  bindersText,
  durationText,
  expressionText,
  templateText,
} from "./values.js";

function correlationLineOf(correlation: CorrelationTemplate): Line {
  const from = expressionText(correlation.from);
  const key = JSON.stringify(correlation.key);
  switch (correlation.expect.kind) {
    case "expected": {
      const expected = templateText(correlation.expect.value);
      return leafOf(`correlate ${key} from ${from} expect ${expected}`);
    }
    case "firstSeen":
      return leafOf(`correlate ${key} from ${from} expect firstSeen`);
  }
}

function attributeTestText(test: AttributeTest): string {
  switch (test.kind) {
    case "pattern":
      return `matches ${JSON.stringify(test.pattern)}`;
    case "equals":
      return `equals ${JSON.stringify(test.value)}`;
    case "condition":
      return `if ${expressionText(test.condition)}`;
  }
}

function filterLineOf(filter: FilterTemplate): Line {
  const members = Array.from(filter.with, ([name, test]) => {
    const shown = JSON.stringify(name);
    const text = attributeTestText(test);

    return labelledOf(`with ${shown}`, text);
  });
  const correlations = filter.correlate.map(correlationLineOf);
  const children = [...members, ...correlations];
  const at = `filter ${String(filter.at.level)}.${String(filter.at.filter)}`;

  return groupOf(at, children);
}

function untilLineOf(until: AnyStrategy["until"]): Line {
  switch (until.kind) {
    case "first":
      return leafOf("until first");
    case "condition": {
      const condition = expressionText(until.condition);
      return labelledOf("until", condition);
    }
    case "strategy": {
      const strategy = strategyLineOf(until.strategy);
      return groupOf("until", [strategy]);
    }
  }
}

function strategyLineOf(strategy: StrategyTemplate): Line {
  const own = levelFiltersOf(strategy);
  const filters = own.map(filterLineOf);

  switch (strategy.kind) {
    case "one":
    case "all":
      return lineOf(strategy.kind, filters);
    case "any": {
      const until = untilLineOf(strategy.until);
      const children = [...filters, until];

      return lineOf("any", children);
    }
  }
}

export function sourceLineOf(source: StreamSource): Line {
  switch (source.kind) {
    case "listen": {
      const strategy = strategyLineOf(source.strategy);
      return lineOf(`listen ${source.read}`, [strategy]);
    }
    case "subscription": {
      const request = asyncApiRequestLinesOf(source.request);
      const filters = source.filters.map((filter) => {
        const condition = expressionText(filter);
        return labelledOf("filter", condition);
      });
      const children = [...request, ...filters];

      return lineOf("subscription", children);
    }
  }
}

function windowText(window: Window): string {
  switch (window.kind) {
    case "open":
      return "open";
    case "closesAfter":
      return `closesAfter ${durationText(window.duration)}`;
  }
}

export function stopLineOf(stop: Stop): Line {
  switch (stop.kind) {
    case "consumption":
      return leafOf("stop consumption");
    case "amount": {
      const window = windowText(stop.window);
      const text = `stop amount ${String(stop.amount)} ${window}`;

      return leafOf(text);
    }
    case "while": {
      const condition = expressionText(stop.condition);
      const window = windowText(stop.window);

      return leafOf(`stop while ${condition} ${window}`);
    }
    case "until": {
      const condition = expressionText(stop.condition);
      const window = windowText(stop.window);

      return leafOf(`stop until ${condition} ${window}`);
    }
  }
}

export function iteratorLineOf(iterator: Iterator, each: Line): Line {
  const binders = bindersText(iterator.binders);
  return lineOf(`each ${binders}`, [each]);
}
