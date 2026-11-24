import type { EffectOutcome } from "../../../api/index.js";
import type { DocumentDecoding } from "./decodings.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, resourceKinds } from "./kinds.js";

export function documentDecodedOf(
  decoding: DocumentDecoding,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(resourceKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  return { value: outcome.document, authorization: null };
}
