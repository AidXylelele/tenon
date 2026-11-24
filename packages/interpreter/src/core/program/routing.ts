import type { CloudEvent, RoutingFilter } from "../../api/index.js";
import {
  type FilterTemplate,
  type StrategyTemplate,
  type Stream,
  type Term,
  constantListOf,
  filterVerdictsOf,
  listenStrategiesOf,
  placedFiltersOf,
} from "../forms/index.js";
import type { Keyed } from "./types.js";

export function routingFiltersOf(
  terms: readonly Term[],
  patterns: ReadonlyMap<string, RegExp>,
): readonly RoutingFilter[] {
  const streams = terms.filter(isStream);
  const listened = streams.flatMap(listenedOf);
  const byStream = new Map(listened);
  const listens = [...byStream];
  const filters = listens.flatMap((listen) =>
    streamFiltersOf(listen, patterns),
  );

  return constantListOf(filters);
}

function isStream(term: Term): term is Stream {
  return term.form === "stream";
}

function listenedOf(stream: Stream): readonly Keyed<StrategyTemplate>[] {
  const strategies = listenStrategiesOf(stream);

  return strategies.map((strategy) => {
    const listened: Keyed<StrategyTemplate> = [stream.id, strategy];
    return listened;
  });
}

function streamFiltersOf(
  listened: Keyed<StrategyTemplate>,
  patterns: ReadonlyMap<string, RegExp>,
): readonly RoutingFilter[] {
  const [stream, strategy] = listened;
  const placed = placedFiltersOf(strategy);

  return placed.map((filter) => routingFilterOf(stream, filter, patterns));
}

function routingFilterOf(
  stream: string,
  filter: FilterTemplate,
  patterns: ReadonlyMap<string, RegExp>,
): RoutingFilter {
  const accepts = (event: CloudEvent): boolean =>
    isRouted(event, filter, patterns);
  const routing: RoutingFilter = {
    stream,
    level: filter.at.level,
    filter: filter.at.filter,
    accepts,
  };

  return Object.freeze(routing);
}

function isRouted(
  event: CloudEvent,
  filter: FilterTemplate,
  patterns: ReadonlyMap<string, RegExp>,
): boolean {
  const verdicts = filterVerdictsOf(event, filter, patterns);
  const fails = verdicts.some((verdict) => verdict.kind === "failed");

  return !fails;
}
