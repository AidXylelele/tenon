import type { EffectOutcome } from "../../../api/index.js";
import type { ElapsedDecoding } from "./decodings.js";
import type { Decoded } from "./decoders.js";
import { checkTaken, timerKinds } from "./kinds.js";

export function elapsedDecodedOf(
  decoding: ElapsedDecoding,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(timerKinds, outcome, decoding);

  return { value: null, authorization: null };
}
