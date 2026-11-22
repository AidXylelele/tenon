import type { EffectOutcome } from "../../../api/index.js";
import type { SubscriptionSource } from "../../../core/index.js";
import type { Delivery } from "../../streams/index.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, subscriptionKinds } from "./kinds.js";

export function deliveryOf(
  subscription: SubscriptionSource,
  outcome: EffectOutcome,
): Delivery {
  checkTaken(subscriptionKinds, outcome, subscription);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  return outcome;
}
