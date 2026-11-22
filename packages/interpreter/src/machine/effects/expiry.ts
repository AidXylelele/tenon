import type { EffectOutcome } from "../../api/index.js";
import { Raised } from "../../runtime/index.js";
import { type Owner, hasOwnerPassed } from "../time/index.js";
import {
  type Transition,
  expiring,
  raising,
  transitionOf,
} from "../transitions/index.js";

const expiredDetail = "The effect expired before it was answered.";

export function isExpiredAnswer(
  outcome: EffectOutcome,
  owner: Owner,
  now: number,
): boolean {
  const isExpired = outcome.kind === "expired";
  const isLate = hasOwnerPassed(owner, now);
  const isTooLate = isExpired || isLate;

  return isTooLate;
}

export function expiredUnder(owner: Owner): Transition {
  switch (owner.kind) {
    case "none":
      return timedOut();
    case "at": {
      const next = expiring(owner);
      return transitionOf(next, [], []);
    }
  }
}

function timedOut(): Transition {
  const timeout = Raised.standard("timeout", expiredDetail);
  const next = raising(timeout.error);

  return transitionOf(next, [], []);
}
