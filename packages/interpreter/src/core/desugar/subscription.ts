import type * as ast from "../../syntax/index.js";
import {
  type Stop,
  type Stream,
  type Window,
  closesAfter,
  openWindow,
  stopAmount,
  stopUntil,
  stopWhile,
  stream,
  subscriptionSource,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { durationOf } from "./durations.js";
import { asyncApiRequestTemplateOf } from "./effects/index.js";
import { addressedExpressionOf, conditionsOf } from "./expressions.js";
import { iteratorsOf } from "./iterator.js";

export function subscriptionOf(
  call: ast.AsyncApiCall,
  subscription: ast.AsyncApiSubscriptionExchange,
  context: Context,
): Stream {
  const id = context.termIdOf(subscription.pointer, "stream");
  const request = asyncApiRequestTemplateOf(call, context);
  const filters = conditionsOf(subscription.filter, context);
  const source = subscriptionSource({ request, filters });
  const stop = lifetimeStopOf(subscription.consume, context);
  const iterators = iteratorsOf(subscription.foreach, context);

  return stream({ id, source, stop, iterators });
}

function lifetimeStopOf(
  lifetime: ast.SubscriptionLifetime,
  context: Context,
): Stop {
  const window = windowOf(lifetime.for, context);

  switch (lifetime.kind) {
    case "amount":
      return stopAmount({ amount: lifetime.amount, window });
    case "while": {
      const condition = addressedExpressionOf(lifetime.while, context);
      return stopWhile({ condition, window });
    }
    case "until": {
      const condition = addressedExpressionOf(lifetime.until, context);
      return stopUntil({ condition, window });
    }
  }
}

function windowOf(duration: ast.Duration | null, context: Context): Window {
  if (duration === null) {
    return openWindow;
  }

  const closing = durationOf(duration, context);
  return closesAfter({ duration: closing });
}
