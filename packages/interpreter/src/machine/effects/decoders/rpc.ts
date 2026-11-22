import type { EffectOutcome } from "../../../api/index.js";
import type { A2aDecoder, McpDecoder } from "../../../core/index.js";
import { Raised } from "../../../runtime/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, rpcKinds } from "./kinds.js";

export function rpcDecodedOf(
  decoding: A2aDecoder | McpDecoder,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(rpcKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  switch (outcome.kind) {
    case "answered":
      return { value: outcome.result, authorization: null };
    case "rpcError": {
      const code = String(outcome.code);
      const detail = `JSON-RPC error ${code}: ${outcome.message}`;
      throw Raised.standard("runtime", detail);
    }
  }
}
