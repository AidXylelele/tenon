import { asyncApiProtocols } from "../../standard/index.js";
import type {
  AsyncApiCall,
  AsyncApiChannelTarget,
  AsyncApiMessageExchange,
  AsyncApiOperationTarget,
  AsyncApiServer,
  AsyncApiSubscriptionExchange,
  SubscriptionLifetime,
} from "../ast/index.js";
import { durationOf } from "./durations.js";
import { externalResourceOf, referenceablePolicyOf } from "./endpoints.js";
import { iteratorOf } from "./events.js";
import { fieldOf, optionalAt, requiredAt, requiredFieldOf } from "./parts.js";
import { numberOf, optionalMemberAt, textOf } from "./scalars.js";
import type { Part } from "./types.js";
import { expressionOf, valueTemplateOf } from "./values.js";

export function asyncApiCallOf(call: Part): AsyncApiCall {
  const document = requiredAt(call, "document", externalResourceOf);
  const target = targetOf(call);
  const server = optionalAt(call, "server", serverOf);
  const protocol = optionalMemberAt(call, "protocol", asyncApiProtocols);
  const exchange = exchangeOf(call);
  const authentication = optionalAt(
    call,
    "authentication",
    referenceablePolicyOf,
  );

  return {
    kind: "asyncapi",
    pointer: call.pointer,
    document,
    target,
    server,
    protocol,
    exchange,
    authentication,
  };
}

function targetOf(call: Part): AsyncApiChannelTarget | AsyncApiOperationTarget {
  const channel = fieldOf(call, "channel");

  if (channel !== null) {
    const name = textOf(channel);
    return { kind: "channel", pointer: channel.pointer, channel: name };
  }

  const operation = requiredFieldOf(call, "operation");
  const name = textOf(operation);
  return { kind: "operation", pointer: operation.pointer, operation: name };
}

function serverOf(part: Part): AsyncApiServer {
  const name = requiredAt(part, "name", textOf);
  const variables = optionalAt(part, "variables", valueTemplateOf);

  return { pointer: part.pointer, name, variables };
}

function exchangeOf(
  call: Part,
): AsyncApiMessageExchange | AsyncApiSubscriptionExchange {
  const message = fieldOf(call, "message");

  if (message === null) {
    return requiredAt(call, "subscription", subscriptionOf);
  }

  const payload = optionalAt(message, "payload", valueTemplateOf);
  const headers = optionalAt(message, "headers", valueTemplateOf);
  return { kind: "message", pointer: message.pointer, payload, headers };
}

function subscriptionOf(part: Part): AsyncApiSubscriptionExchange {
  const filter = optionalAt(part, "filter", expressionOf);
  const consume = requiredAt(part, "consume", lifetimeOf);
  const foreach = optionalAt(part, "foreach", iteratorOf);

  return {
    kind: "subscription",
    pointer: part.pointer,
    filter,
    consume,
    foreach,
  };
}

function lifetimeOf(part: Part): SubscriptionLifetime {
  const duration = optionalAt(part, "for", durationOf);
  const amount = fieldOf(part, "amount");
  const repeat = fieldOf(part, "while");

  if (amount !== null) {
    const count = numberOf(amount);
    return {
      kind: "amount",
      pointer: part.pointer,
      amount: count,
      for: duration,
    };
  }

  if (repeat !== null) {
    const condition = expressionOf(repeat);
    return {
      kind: "while",
      pointer: part.pointer,
      while: condition,
      for: duration,
    };
  }

  const until = requiredAt(part, "until", expressionOf);
  return { kind: "until", pointer: part.pointer, until, for: duration };
}
