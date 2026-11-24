import type {
  AsyncApiInboundMessage,
  CloudEvent,
  EffectOutcome,
  JsonValue,
} from "../../api/index.js";
import type { ListenSource } from "../../core/index.js";
import { type JsonOf, eventReadAs } from "../../runtime/index.js";
import type { ReceiveK, StreamK } from "../frames/index.js";
import {
  type Delivery,
  type Offered,
  advancedWith,
  awaitingNextOf,
  finishedOf,
  isAccepted,
  isStopped,
  itemAwaitedOf,
  itemWithdrawnOf,
  matcherOf,
  nextValuesOf,
  offerOf,
  takenOf,
  taskPhaseOf,
  windowedOf,
} from "../streams/index.js";
import type { Owner } from "../time/index.js";
import {
  type Transition,
  type Write,
  declined,
  suspending,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";
import { deliveryOf, offeredEventOf } from "./decoders/index.js";
import { itemEffectOf } from "./effect.js";
import { expiredUnder, isExpiredAnswer } from "./expiry.js";

interface Offering {
  readonly listen: ListenSource;
  readonly event: CloudEvent;
}

export function respondToReceive(
  frame: ReceiveK,
  outcome: EffectOutcome,
  view: View,
): Transition {
  const owner = view.deadline();
  const expired = isExpiredAnswer(outcome, owner, view.context.now);

  if (expired) {
    return tooLateOf(frame, outcome, owner);
  }

  const source = frame.stream.source;

  switch (source.kind) {
    case "listen": {
      const event = offeredEventOf(source, outcome);
      const offering: Offering = { listen: source, event };
      return offeredTo(frame, offering, view);
    }
    case "subscription": {
      const delivery = deliveryOf(source, outcome);
      return deliveredOf(frame, delivery, view);
    }
  }
}

function tooLateOf(
  frame: ReceiveK,
  outcome: EffectOutcome,
  owner: Owner,
): Transition {
  const expiry = expiredUnder(owner);
  const isOffer = outcome.kind === "event" || outcome.kind === "message";

  if (!isOffer) {
    return expiry;
  }

  const withdrawal = itemWithdrawnOf(frame);
  const writes = [withdrawal, ...expiry.writes];

  return transitionOf(expiry.next, expiry.push, writes);
}

function offeredTo(
  frame: ReceiveK,
  offering: Offering,
  view: View,
): Transition {
  const matcher = matcherOf(frame, view);
  const event = offering.event;
  const offered: Offered = { consumption: frame.consumption, event };
  const offer = offerOf(offering.listen.strategy, offered, matcher);

  switch (offer.kind) {
    case "declined":
      return declinedBy(frame, event);
    case "until": {
      const counted = advancedWith(frame, offer.consumption);
      return countedOf(counted, view);
    }
    case "item": {
      const taking = advancedWith(frame, offer.consumption);
      const item = eventReadAs(event, offering.listen.read);
      const resumed = taskPhaseOf(frame, "running", view);
      return takenOf(taking, item, resumed);
    }
  }
}

function declinedBy(frame: ReceiveK, event: CloudEvent): Transition {
  const refusal = declined(event.id);
  const frames = [frame];
  const writes = [refusal];

  return transitionOf(suspending, frames, writes);
}

function countedOf(counted: StreamK, view: View): Transition {
  const stopped = isStopped(counted, view);

  if (!stopped) {
    return askedAgainOf(counted, view);
  }

  const resumed = taskPhaseOf(counted, "running", view);
  return finishedOf(counted, resumed, view);
}

function deliveredOf(
  frame: ReceiveK,
  delivery: Delivery,
  view: View,
): Transition {
  const now = view.context.now;
  const windowed = windowedOf(delivery, frame.window, now);

  switch (windowed.kind) {
    case "closed":
      return subscriptionEndedOf(frame, [], view);
    case "pastWindow": {
      const withdrawal = itemWithdrawnOf(frame);
      return subscriptionEndedOf(frame, [withdrawal], view);
    }
    case "message": {
      const message: JsonOf<AsyncApiInboundMessage> = windowed.message;
      return messageDecidedOf(frame, message, view);
    }
  }
}

function subscriptionEndedOf(
  frame: ReceiveK,
  before: readonly Write[],
  view: View,
): Transition {
  const resumed = taskPhaseOf(frame, "running", view);
  const writes = [...before, ...resumed];

  return finishedOf(frame, writes, view);
}

function messageDecidedOf(
  frame: ReceiveK,
  message: JsonValue,
  view: View,
): Transition {
  const advanced = advancedWith(frame, frame.consumption);
  const accepted = isAccepted(frame, message, view);

  if (!accepted) {
    return askedAgainOf(advanced, view);
  }

  const resumed = taskPhaseOf(frame, "running", view);
  return takenOf(advanced, message, resumed);
}

function askedAgainOf(frame: StreamK, view: View): Transition {
  const awaiting = awaitingNextOf(frame);
  const values = nextValuesOf(frame, view);
  const effect = itemEffectOf(awaiting, values, view);

  return itemAwaitedOf(awaiting, effect, []);
}
