import type { EffectOutcome, JsonValue } from "../../api/index.js";
import { normalOf } from "../completions/index.js";
import type { AwaitK } from "../frames/index.js";
import { awaitedPhaseOf, phaseChangedOf } from "../lifecycle/index.js";
import { withAuthorization, withPhase } from "../registers/index.js";
import {
  type Transition,
  type Write,
  returning,
  transitionOf,
  updated,
} from "../transitions/index.js";
import type { View } from "../view.js";
import {
  type Decoded,
  awaitedDecodingOf,
  decodedOf,
} from "./decoders/index.js";
import { expiredUnder, isExpiredAnswer } from "./expiry.js";

export function respondToAwait(
  frame: AwaitK,
  outcome: EffectOutcome,
  view: View,
): Transition {
  const owner = view.deadline();
  const expired = isExpiredAnswer(outcome, owner, view.context.now);

  if (expired) {
    return expiredUnder(owner);
  }

  const awaited = awaitedDecodingOf(frame.effect);
  const decoded = decodedOf(awaited.decoding, outcome, awaited.carried);
  const writes = cellAnsweredOf(frame, decoded, view);
  const done = normalOf(decoded.value);
  const next = returning(done);

  return transitionOf(next, [], writes);
}

function cellAnsweredOf(
  frame: AwaitK,
  decoded: Decoded,
  view: View,
): readonly Write[] {
  switch (frame.effect.kind) {
    case "perform":
      return authorizedOf(frame, decoded.authorization, view);
    case "schema":
      return [];
    case "retry":
      return phaseChangedOf(frame.activation, "running", view);
  }
}

function authorizedOf(
  frame: AwaitK,
  authorization: JsonValue,
  view: View,
): readonly Write[] {
  const address = frame.activation;
  const cell = view.store.cellAt(address);
  const authorized = withAuthorization(cell, authorization);
  const awaited = awaitedPhaseOf(frame);

  switch (awaited) {
    case "running": {
      const update = updated(address, authorized);
      return [update];
    }
    case "waiting": {
      const running = withPhase(authorized, "running");
      const update = updated(address, running);
      return [update];
    }
  }
}
