import type {
  AsyncApiMessageExchange,
  AsyncApiSubscriptionExchange,
  ConsumptionStrategy,
  Correlation,
  EventFilter,
  EventProperties,
  Expression,
  FilterAttribute,
  SubscriptionIterator,
  SubscriptionLifetime,
} from "../../syntax/index.js";
import { at, iterationBindersOf, within } from "./contexts.js";
import {
  durationOccurrencesOf,
  fieldOccurrencesOf,
  outputOccurrencesOf,
  templateOccurrencesOf,
} from "./data.js";
import { taskListOccurrencesOf } from "./tasks.js";
import type { Context, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function eventOccurrencesOf(
  event: EventProperties,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(event.id, context),
    ...templateOccurrencesOf(event.source, context),
    ...templateOccurrencesOf(event.type, context),
    ...templateOccurrencesOf(event.time, context),
    ...templateOccurrencesOf(event.subject, context),
    ...templateOccurrencesOf(event.datacontenttype, context),
    ...templateOccurrencesOf(event.dataschema, context),
    ...templateOccurrencesOf(event.data, context),
    ...fieldOccurrencesOf(event.additional, context),
  ];
}

export function strategyOccurrencesOf(
  strategy: ConsumptionStrategy,
  context: Context,
): readonly Occurrence[] {
  switch (strategy.kind) {
    case "all":
      return filtersOccurrencesOf(strategy.filters, context);
    case "any":
      return [
        ...filtersOccurrencesOf(strategy.filters, context),
        ...untilOccurrencesOf(strategy.until, context),
      ];
    case "one":
      return filterOccurrencesOf(strategy.filter, context);
  }
}

export function iteratorOccurrencesOf(
  iterator: SubscriptionIterator | null,
  context: Context,
): readonly Occurrence[] {
  if (iterator === null) {
    return none;
  }

  const { pointer, item, at: index } = iterator;
  const binders = iterationBindersOf(pointer, item, index);
  const each = within(context, binders);
  const output = at(each, "iteratorOutput");
  const exported = at(each, "iteratorExport");

  return [
    { kind: "binders", binders, context },
    ...taskListOccurrencesOf(iterator.do, "sequence", each),
    ...outputOccurrencesOf(iterator.output, output),
    ...outputOccurrencesOf(iterator.export, exported),
  ];
}

export function exchangeOccurrencesOf(
  exchange: AsyncApiMessageExchange | AsyncApiSubscriptionExchange,
  context: Context,
): readonly Occurrence[] {
  switch (exchange.kind) {
    case "message":
      return [
        ...templateOccurrencesOf(exchange.payload, context),
        ...templateOccurrencesOf(exchange.headers, context),
      ];
    case "subscription":
      return [
        ...templateOccurrencesOf(exchange.filter, context),
        ...lifetimeOccurrencesOf(exchange.consume, context),
        ...iteratorOccurrencesOf(exchange.foreach, context),
      ];
  }
}

function filtersOccurrencesOf(
  filters: readonly EventFilter[],
  context: Context,
): readonly Occurrence[] {
  return filters.flatMap((filter) => filterOccurrencesOf(filter, context));
}

function filterOccurrencesOf(
  filter: EventFilter,
  context: Context,
): readonly Occurrence[] {
  const correlations = [...filter.correlate.values()];
  const correlated = correlations.flatMap((correlation) =>
    correlationOccurrencesOf(correlation, context),
  );

  const attributes = [...filter.with.attributes.values()];

  return [
    { kind: "filter", filter, context },
    ...attributes.flatMap((attribute) =>
      attributeOccurrencesOf(attribute, context),
    ),
    ...correlated,
  ];
}

function attributeOccurrencesOf(
  attribute: FilterAttribute,
  context: Context,
): readonly Occurrence[] {
  switch (attribute.kind) {
    case "condition":
      return templateOccurrencesOf(attribute.condition, context);
    case "pattern":
    case "value":
      return none;
  }
}

function correlationOccurrencesOf(
  correlation: Correlation,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(correlation.from, context),
    ...templateOccurrencesOf(correlation.expect, context),
  ];
}

function untilOccurrencesOf(
  until: Expression | ConsumptionStrategy | null,
  context: Context,
): readonly Occurrence[] {
  if (until === null) {
    return none;
  }

  switch (until.kind) {
    case "expression":
      return templateOccurrencesOf(until, context);
    case "all":
    case "any":
    case "one":
      return strategyOccurrencesOf(until, context);
  }
}

function lifetimeOccurrencesOf(
  lifetime: SubscriptionLifetime,
  context: Context,
): readonly Occurrence[] {
  switch (lifetime.kind) {
    case "amount":
      return durationOccurrencesOf(lifetime.for, context);
    case "while":
      return [
        ...templateOccurrencesOf(lifetime.while, context),
        ...durationOccurrencesOf(lifetime.for, context),
      ];
    case "until":
      return [
        ...templateOccurrencesOf(lifetime.until, context),
        ...durationOccurrencesOf(lifetime.for, context),
      ];
  }
}
