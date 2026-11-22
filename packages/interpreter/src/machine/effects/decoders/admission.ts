import type { EffectOutcome } from "../../../api/index.js";
import { type Taker, checkKindIn, takenKindsOf } from "./kinds.js";
import { checkCloudEvent } from "./offered.js";

export function checkAnswer(taker: Taker, outcome: EffectOutcome): void {
  const isExpired = outcome.kind === "expired";

  if (isExpired) {
    return;
  }

  const kinds = takenKindsOf(taker);
  checkKindIn(kinds, outcome, taker);

  const isEvent = outcome.kind === "event";

  if (isEvent) {
    checkCloudEvent(outcome.event);
  }
}
