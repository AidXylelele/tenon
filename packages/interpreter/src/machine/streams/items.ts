import type { Effect, JsonArray, JsonValue } from "../../api/index.js";
import {
  type Iterator,
  type ListenSource,
  type StreamSource,
  constantListOf,
} from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { normalOf } from "../completions/index.js";
import {
  type Consumption,
  type Expectation,
  type ReceiveK,
  type StreamFrame,
  type StreamItemK,
  type StreamK,
  consumptionOf,
  receiveK,
  streamItemK,
  streamItemOf,
  streamK,
} from "../frames/index.js";
import {
  type ItemKey,
  effectIdOf,
  eventKeyOf,
  iterationPathOf,
  messageKeyOf,
} from "../identity/index.js";
import { type BoundValues, type Here, scopeOf } from "../registers/index.js";
import {
  type Evaluating,
  type Transition,
  type Write,
  evaluating,
  requested,
  returning,
  suspending,
  transitionOf,
  withdrawn,
} from "../transitions/index.js";
import type { ListenStart, View } from "../view.js";
import { correlationEndOf, expectationsOf } from "./correlation.js";
import { nothingAccepted } from "./strategies.js";

const noItems: JsonArray = constantListOf([]);

const noExpectations: readonly Expectation[] = constantListOf([]);

const noKeys = Object.freeze({});

const nothingConsumed: Consumption = subscriptionStartOf();

const firstIterator = 0;

export function consumptionAtStartOf(
  source: StreamSource,
  here: Here,
  view: View,
): Consumption {
  switch (source.kind) {
    case "listen": {
      const start = listenStartOf(source, view);
      const expected = expectationsOf(start.filters, here, view);
      return consumptionOf({
        items: [],
        position: 0,
        accepted: start.accepted,
        keys: {},
        expected,
      });
    }
    case "subscription":
      return nothingConsumed;
  }
}

function listenStartOf(listen: ListenSource, view: View): ListenStart {
  const start = view.statics.listens.get(listen);

  if (start === undefined) {
    throw new InterpreterError("The runner derived no start of the listen.");
  }

  return start;
}

function subscriptionStartOf(): Consumption {
  const consumption = consumptionOf({
    items: noItems,
    position: 0,
    accepted: nothingAccepted,
    keys: noKeys,
    expected: noExpectations,
  });

  return Object.freeze(consumption);
}

export function awaitingNextOf(frame: StreamK): ReceiveK {
  const effect = itemKeyOf(frame);

  return receiveK({
    stream: frame.stream,
    consumption: frame.consumption,
    window: frame.window,
    input: frame.input,
    effect,
    scope: frame.scope,
  });
}

export function itemWithdrawnOf(frame: ReceiveK): Write {
  const id = effectIdOf(frame.effect);
  return withdrawn(id);
}

export function itemAwaitedOf(
  awaiting: ReceiveK,
  effect: Effect,
  writes: readonly Write[],
): Transition {
  const asked = requested(effect);
  const all = [asked, ...writes];
  const frames = [awaiting];

  return transitionOf(suspending, frames, all);
}

function itemKeyOf(frame: StreamK): ItemKey {
  const path = frame.scope.path;
  const position = frame.consumption.position;

  switch (frame.stream.source.kind) {
    case "listen":
      return eventKeyOf(path, position);
    case "subscription":
      return messageKeyOf(path, position);
  }
}

export function advancedWith(
  frame: ReceiveK,
  consumption: Consumption,
): StreamK {
  const advanced = consumptionOf({
    items: consumption.items,
    position: consumption.position + 1,
    accepted: consumption.accepted,
    keys: consumption.keys,
    expected: consumption.expected,
  });

  return streamOf(frame, advanced);
}

export function collectedOf(frame: StreamK, value: JsonValue): StreamK {
  const consumption = frame.consumption;
  const items = [...consumption.items, value];
  const collected = consumptionOf({
    items,
    position: consumption.position,
    accepted: consumption.accepted,
    keys: consumption.keys,
    expected: consumption.expected,
  });

  return streamOf(frame, collected);
}

export function finishedOf(
  frame: StreamFrame,
  writes: readonly Write[],
  view: View,
): Transition {
  const done = normalOf(frame.consumption.items);
  const next = returning(done);
  const correlated = correlationEndOf(frame, view);
  const all = [...writes, ...correlated];

  return transitionOf(next, [], all);
}

export function takenOf(
  collecting: StreamK,
  item: JsonValue,
  writes: readonly Write[],
): Transition {
  const stream = collecting.stream;
  const iterator = stream.iterators[firstIterator];

  if (iterator === undefined) {
    const done = normalOf(item);
    const next = returning(done);
    const frames = [collecting];
    return transitionOf(next, frames, writes);
  }

  const index = collecting.consumption.items.length;
  const taken = streamItemOf(item, index);
  const running = streamItemK({
    stream,
    iterator: firstIterator,
    item: taken,
    scope: collecting.scope,
  });
  const next = iteratorEnteredOf(running, iterator);
  const frames = [collecting, running];

  return transitionOf(next, frames, writes);
}

export function iteratorEnteredOf(
  frame: StreamItemK,
  iterator: Iterator,
): Evaluating {
  const item = frame.item;
  const bound: BoundValues = { item: item.value, index: item.index };
  const environment = frame.scope.environment.bound(iterator.binders, bound);
  const path = iterationPathOf(frame.scope.path, item.index);
  const scope = scopeOf(environment, frame.scope.activation, path);
  const here: Here = { scope, value: item.value };

  return evaluating(iterator.each, here);
}

function streamOf(frame: StreamFrame, consumption: Consumption): StreamK {
  return streamK({
    stream: frame.stream,
    consumption,
    window: frame.window,
    input: frame.input,
    scope: frame.scope,
  });
}
