import type { CloudEvent, JsonObject } from "../../api/index.js";
import {
  type AnyStrategy,
  type Expression,
  type FilterAt,
  type StrategyTemplate,
  type StreamSource,
  belowOf,
  constantListOf,
  levelFiltersOf,
} from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import {
  type Acceptances,
  type Consumption,
  acceptancesOf,
  consumptionOf,
  noUntil,
} from "../frames/index.js";
import type { Matcher } from "./filters.js";

export interface Offered {
  readonly consumption: Consumption;
  readonly event: CloudEvent;
}

interface DeclinedOffer {
  readonly kind: "declined";
}

interface UntilOffer {
  readonly kind: "until";
  readonly consumption: Consumption;
}

interface ItemOffer {
  readonly kind: "item";
  readonly consumption: Consumption;
}

type Offer = DeclinedOffer | UntilOffer | ItemOffer;

export interface StopReader {
  holds(condition: Expression): boolean;
}

interface NoneTaken {
  readonly kind: "none";
}

interface LevelTaken {
  readonly kind: "until" | "own";
  readonly accepted: Acceptances;
  readonly keys: JsonObject;
}

type Taken = NoneTaken | LevelTaken;

interface LevelOffering {
  readonly event: CloudEvent;
  readonly matcher: Matcher;
}

const declinedOffer: Offer = { kind: "declined" };

const noneTaken: Taken = { kind: "none" };

const noneAccepted: readonly number[] = constantListOf([]);

export const nothingAccepted: Acceptances = unacceptedAbove(noUntil);

export function offerOf(
  strategy: StrategyTemplate,
  offered: Offered,
  matcher: Matcher,
): Offer {
  const consumption = offered.consumption;
  const offering: LevelOffering = { event: offered.event, matcher };
  const taken = takenAt(strategy, consumption.accepted, offering);

  switch (taken.kind) {
    case "none":
      return declinedOffer;
    case "until": {
      const counted = consumedWith(consumption, taken);
      return { kind: "until", consumption: counted };
    }
    case "own": {
      const consumed = consumedWith(consumption, taken);
      return { kind: "item", consumption: consumed };
    }
  }
}

export function isSatisfiedBy(
  strategy: StrategyTemplate,
  consumption: Consumption,
  reader: StopReader,
): boolean {
  return isSatisfiedAt(strategy, consumption.accepted, reader);
}

export function openFiltersOf(
  strategy: StrategyTemplate,
  consumption: Consumption,
): readonly FilterAt[] {
  return openAt(strategy, consumption.accepted);
}

export function nothingAcceptedOf(strategy: StrategyTemplate): Acceptances {
  const below = belowOf(strategy);

  switch (below.kind) {
    case "none":
      return nothingAccepted;
    case "strategy": {
      const nested = nothingAcceptedOf(below.strategy);
      return unacceptedAbove(nested);
    }
  }
}

function unacceptedAbove(until: Acceptances["until"]): Acceptances {
  const accepted = acceptancesOf(noneAccepted, until);
  return Object.freeze(accepted);
}

export function strategyOf(source: StreamSource): StrategyTemplate {
  switch (source.kind) {
    case "listen":
      return source.strategy;
    case "subscription":
      throw new InterpreterError(
        "A subscription stops by its consumption, never by a strategy.",
      );
  }
}

function takenAt(
  strategy: StrategyTemplate,
  accepted: Acceptances,
  offering: LevelOffering,
): Taken {
  const byUntil = untilTakenOf(strategy, accepted, offering);

  switch (byUntil.kind) {
    case "none":
      return ownTakenOf(strategy, accepted, offering);
    case "until":
    case "own":
      return byUntil;
  }
}

function untilTakenOf(
  strategy: StrategyTemplate,
  accepted: Acceptances,
  offering: LevelOffering,
): Taken {
  const below = belowOf(strategy);

  switch (below.kind) {
    case "none":
      return noneTaken;
    case "strategy": {
      const nested = untilAcceptancesOf(accepted);
      const taken = takenAt(below.strategy, nested, offering);
      return untilTakenWith(accepted, taken);
    }
  }
}

function untilTakenWith(accepted: Acceptances, taken: Taken): Taken {
  switch (taken.kind) {
    case "none":
      return taken;
    case "until":
    case "own": {
      const level = acceptancesOf(accepted.own, taken.accepted);
      return { kind: "until", accepted: level, keys: taken.keys };
    }
  }
}

function ownTakenOf(
  strategy: StrategyTemplate,
  accepted: Acceptances,
  offering: LevelOffering,
): Taken {
  const filters = levelFiltersOf(strategy);

  for (const filter of filters) {
    const index = filter.at.filter;
    const open = isOpen(strategy, accepted, index);

    if (!open) {
      continue;
    }

    const match = offering.matcher.accepts(filter, offering.event);

    if (match.kind === "matched") {
      return ownAt(accepted, index, match.keys);
    }
  }

  return noneTaken;
}

function ownAt(accepted: Acceptances, index: number, keys: JsonObject): Taken {
  const own = [...accepted.own, index];
  const level = acceptancesOf(own, accepted.until);

  return { kind: "own", accepted: level, keys };
}

function consumedWith(
  consumption: Consumption,
  taken: LevelTaken,
): Consumption {
  return consumptionOf({
    items: consumption.items,
    position: consumption.position,
    accepted: taken.accepted,
    keys: taken.keys,
    expected: consumption.expected,
  });
}

function isSatisfiedAt(
  strategy: StrategyTemplate,
  accepted: Acceptances,
  reader: StopReader,
): boolean {
  switch (strategy.kind) {
    case "one":
      return accepted.own.length > 0;
    case "all": {
      const indices = [...strategy.filters.keys()];
      return indices.every((index) => accepted.own.includes(index));
    }
    case "any":
      return isUntilReached(strategy.until, accepted, reader);
  }
}

function isUntilReached(
  until: AnyStrategy["until"],
  accepted: Acceptances,
  reader: StopReader,
): boolean {
  const consumed = accepted.own.length > 0;

  switch (until.kind) {
    case "first":
      return consumed;
    case "condition": {
      if (!consumed) {
        return false;
      }

      const holding = reader.holds(until.condition);
      return holding;
    }
    case "strategy": {
      const below = untilAcceptancesOf(accepted);
      return isSatisfiedAt(until.strategy, below, reader);
    }
  }
}

function openAt(
  strategy: StrategyTemplate,
  accepted: Acceptances,
): readonly FilterAt[] {
  const filters = levelFiltersOf(strategy);
  const open = filters.filter((filter) =>
    isOpen(strategy, accepted, filter.at.filter),
  );
  const own = open.map((filter) => filter.at);
  const below = belowOf(strategy);

  switch (below.kind) {
    case "none":
      return own;
    case "strategy": {
      const nested = untilAcceptancesOf(accepted);
      const deeper = openAt(below.strategy, nested);
      return [...own, ...deeper];
    }
  }
}

function isOpen(
  strategy: StrategyTemplate,
  accepted: Acceptances,
  index: number,
): boolean {
  switch (strategy.kind) {
    case "all":
      return !accepted.own.includes(index);
    case "one":
    case "any":
      return true;
  }
}

function untilAcceptancesOf(accepted: Acceptances): Acceptances {
  const until = accepted.until;

  switch (until.kind) {
    case "none":
      throw new InterpreterError(
        "The acceptances of a stream hold no level for its until strategy.",
      );
    case "strategy":
      return until;
  }
}
