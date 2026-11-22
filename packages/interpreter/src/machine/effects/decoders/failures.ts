import type { EffectOutcome, Failure } from "../../../api/index.js";
import { Raised } from "../../../runtime/index.js";

const unreachableStatus = 503;

type HostFailure = Exclude<Failure, { readonly kind: "expired" }>;

export const hostFailureKinds: Readonly<Record<HostFailure["kind"], true>> = {
  unreachable: true,
  rejected: true,
  unauthenticated: true,
  forbidden: true,
  misconfigured: true,
};

export function isHostFailure(outcome: EffectOutcome): outcome is HostFailure {
  return Object.hasOwn(hostFailureKinds, outcome.kind);
}

export function failureErrorOf(failure: HostFailure): Raised {
  switch (failure.kind) {
    case "unreachable":
      return Raised.withStatus({
        name: "communication",
        detail: failure.detail,
        status: unreachableStatus,
      });
    case "rejected":
      return Raised.withStatus({
        name: "communication",
        detail: failure.detail,
        status: failure.statusCode,
      });
    case "unauthenticated":
      return Raised.standard("authentication", failure.detail);
    case "forbidden":
      return Raised.standard("authorization", failure.detail);
    case "misconfigured":
      return Raised.standard("configuration", failure.detail);
  }
}
