import type { EffectOutcome, GrpcOutcome } from "../../../api/index.js";
import type { GrpcDecoder } from "../../../core/index.js";
import { Raised } from "../../../runtime/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, grpcKinds } from "./kinds.js";

type GrpcStatus = Extract<GrpcOutcome, { readonly kind: "status" }>;

const httpStatuses: ReadonlyMap<number, number> = new Map([
  [1, 499],
  [2, 500],
  [3, 400],
  [4, 504],
  [5, 404],
  [6, 409],
  [7, 403],
  [8, 429],
  [9, 400],
  [10, 409],
  [11, 400],
  [12, 501],
  [13, 500],
  [14, 503],
  [15, 500],
  [16, 401],
]);

const unmappedStatus = 500;

export function grpcDecodedOf(
  decoding: GrpcDecoder,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(grpcKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  switch (outcome.kind) {
    case "replied":
      return { value: outcome.message, authorization: null };
    case "status":
      throw statusErrorOf(outcome);
  }
}

function statusErrorOf(grpc: GrpcStatus): Raised {
  const status = httpStatuses.get(grpc.code) ?? unmappedStatus;

  return Raised.withStatus({
    name: "communication",
    detail: grpc.message,
    status,
  });
}
