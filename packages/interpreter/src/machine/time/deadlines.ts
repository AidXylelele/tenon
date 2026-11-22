import type { JsonObject } from "../../api/index.js";
import { Raised } from "../../runtime/index.js";
import { type DeadlineK, deadlineK } from "../frames/index.js";
import type { FiberId } from "../registers/index.js";

interface Unlimited {
  readonly kind: "none";
}

export interface OwnedAt {
  readonly kind: "at";
  readonly instant: number;
  readonly fiber: FiberId;
  readonly depth: number;
}

export type Owner = Unlimited | OwnedAt;

interface Passed {
  readonly kind: "passed";
  readonly timeout: JsonObject;
}

interface Running {
  readonly kind: "running";
  readonly frame: DeadlineK;
}

type LimitEntry = Passed | Running;

const passedDetail = "A time limit passed.";

export function limitEntryOf(instant: number, now: number): LimitEntry {
  const isPassed = hasPassed(instant, now);

  if (isPassed) {
    const timeout = timeoutOf();
    return { kind: "passed", timeout: timeout.error };
  }

  const frame = deadlineK({ instant });
  return { kind: "running", frame };
}

export function hasPassed(instant: number, now: number): boolean {
  return instant <= now;
}

export function hasOwnerPassed(owner: Owner, now: number): boolean {
  switch (owner.kind) {
    case "none":
      return false;
    case "at":
      return hasPassed(owner.instant, now);
  }
}

export function timeoutOf(): Raised {
  return Raised.standard("timeout", passedDetail);
}
