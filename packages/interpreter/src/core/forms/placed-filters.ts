import { nothingBelow } from "./factory.js";
import type {
  FilterTemplate,
  NothingBelow,
  StrategyTemplate,
  UntilStrategy,
} from "./streams.js";
import type { Stream } from "./terms.js";

const none: readonly StrategyTemplate[] = [];

export function listenStrategiesOf(
  stream: Stream,
): readonly StrategyTemplate[] {
  const source = stream.source;

  switch (source.kind) {
    case "listen":
      return [source.strategy];
    case "subscription":
      return none;
  }
}

export function placedFiltersOf(
  strategy: StrategyTemplate,
): readonly FilterTemplate[] {
  const own = levelFiltersOf(strategy);
  const below = belowOf(strategy);

  switch (below.kind) {
    case "none":
      return own;
    case "strategy": {
      const deeper = placedFiltersOf(below.strategy);
      return [...own, ...deeper];
    }
  }
}

export function levelFiltersOf(
  strategy: StrategyTemplate,
): readonly FilterTemplate[] {
  switch (strategy.kind) {
    case "one":
      return [strategy.filter];
    case "all":
    case "any":
      return strategy.filters;
  }
}

export function belowOf(
  strategy: StrategyTemplate,
): NothingBelow | UntilStrategy {
  if (strategy.kind !== "any") {
    return nothingBelow;
  }

  const until = strategy.until;

  switch (until.kind) {
    case "first":
    case "condition":
      return nothingBelow;
    case "strategy":
      return until;
  }
}
