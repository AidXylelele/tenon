import type { JsonObject } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import {
  type Acceptances,
  type Consumption,
  type Expectation,
  type StreamItem,
  type StreamWindow,
  acceptancesOf,
  consumptionOf,
  expectationOf,
  noUntil,
  openWindow,
  streamItemOf,
  windowClosingAt,
} from "../frames/index.js";
import {
  type KindSet,
  arrayAt,
  fieldAt,
  indexAt,
  indicesAt,
  kindAt,
  numberAt,
  objectAt,
  objectsAt,
  stringAt,
} from "./fields.js";

type Until = Acceptances["until"];

const untilKinds: KindSet<Until["kind"]> = { strategy: true, none: true };

const windowKinds: KindSet<StreamWindow["kind"]> = {
  open: true,
  closesAt: true,
};

export function encodeConsumption(consumption: Consumption): JsonObject {
  const accepted = encodeUntil(consumption.accepted);
  const expected = consumption.expected.map(encodeExpectation);

  return {
    items: consumption.items,
    position: consumption.position,
    accepted,
    keys: consumption.keys,
    expected,
  };
}

function encodeUntil(until: Until): JsonObject {
  switch (until.kind) {
    case "none":
      return { kind: until.kind };
    case "strategy": {
      const nested = encodeUntil(until.until);
      return { kind: until.kind, own: until.own, until: nested };
    }
  }
}

function encodeExpectation(expectation: Expectation): JsonObject {
  return {
    level: expectation.level,
    filter: expectation.filter,
    correlation: expectation.correlation,
    value: expectation.value,
  };
}

export function consumptionAt(encoded: JsonObject, key: string): Consumption {
  const consumption = objectAt(encoded, key);
  const items = arrayAt(consumption, "items");
  const position = indexAt(consumption, "position");
  const accepted = acceptancesAt(consumption, "accepted");
  const keys = objectAt(consumption, "keys");
  const expectations = objectsAt(consumption, "expected");
  const expected = expectations.map(decodeExpectation);

  return consumptionOf({ items, position, accepted, keys, expected });
}

function acceptancesAt(encoded: JsonObject, key: string): Acceptances {
  const accepted = untilAt(encoded, key);

  if (accepted.kind === "none") {
    throw new InterpreterError(`The state holds no strategy at '${key}'.`);
  }

  return accepted;
}

function untilAt(encoded: JsonObject, key: string): Until {
  const until = objectAt(encoded, key);
  const kind = kindAt(until, untilKinds);

  switch (kind) {
    case "none":
      return noUntil;
    case "strategy": {
      const own = indicesAt(until, "own");
      const nested = untilAt(until, "until");
      return acceptancesOf(own, nested);
    }
  }
}

function decodeExpectation(encoded: JsonObject): Expectation {
  const level = indexAt(encoded, "level");
  const filter = indexAt(encoded, "filter");
  const correlation = stringAt(encoded, "correlation");
  const value = fieldAt(encoded, "value");

  return expectationOf({ level, filter, correlation, value });
}

export function encodeWindow(window: StreamWindow): JsonObject {
  switch (window.kind) {
    case "open":
      return { kind: window.kind };
    case "closesAt":
      return { kind: window.kind, instant: window.instant };
  }
}

export function windowAt(encoded: JsonObject, key: string): StreamWindow {
  const window = objectAt(encoded, key);
  const kind = kindAt(window, windowKinds);

  switch (kind) {
    case "open":
      return openWindow;
    case "closesAt": {
      const instant = numberAt(window, "instant");
      return windowClosingAt(instant);
    }
  }
}

export function encodeItem(item: StreamItem): JsonObject {
  return { value: item.value, index: item.index };
}

export function itemAt(encoded: JsonObject, key: string): StreamItem {
  const item = objectAt(encoded, key);
  const value = fieldAt(item, "value");
  const index = indexAt(item, "index");

  return streamItemOf(value, index);
}
