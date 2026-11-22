import type { EffectOutcome, JsonValue } from "../../../api/index.js";
import type { SentDecoder } from "../../../core/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, emitKinds, publishKinds } from "./kinds.js";

export function sentDecodedOf(
  decoding: SentDecoder,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  checkSent(decoding, outcome);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  return { value: carried, authorization: null };
}

type SentKind = keyof typeof emitKinds | keyof typeof publishKinds;

function checkSent(
  decoding: SentDecoder,
  outcome: EffectOutcome,
): asserts outcome is Extract<EffectOutcome, { readonly kind: SentKind }> {
  switch (decoding.awaits) {
    case "emit":
      checkTaken(emitKinds, outcome, decoding);
      return;
    case "asyncapi":
      checkTaken(publishKinds, outcome, decoding);
      return;
  }
}
