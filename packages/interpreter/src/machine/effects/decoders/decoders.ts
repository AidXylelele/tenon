import type { EffectOutcome, JsonValue } from "../../../api/index.js";
import type { Decoding } from "./decodings.js";
import { documentDecodedOf } from "./document.js";
import { elapsedDecodedOf } from "./elapsed.js";
import { grpcDecodedOf } from "./grpc.js";
import { httpDecodedOf } from "./http.js";
import { inputDecodedOf } from "./input.js";
import { processDecodedOf } from "./process.js";
import { rpcDecodedOf } from "./rpc.js";
import { sentDecodedOf } from "./sent.js";
import { workflowDecodedOf } from "./workflow.js";

export interface Decoded {
  readonly value: JsonValue;
  readonly authorization: JsonValue;
}

export function decodedOf(
  decoding: Decoding,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  switch (decoding.kind) {
    case "input":
      return inputDecodedOf(decoding, outcome, carried);
    case "sent":
      return sentDecodedOf(decoding, outcome, carried);
    case "http":
      return httpDecodedOf(decoding, outcome);
    case "grpc":
      return grpcDecodedOf(decoding, outcome);
    case "a2a":
    case "mcp":
      return rpcDecodedOf(decoding, outcome);
    case "process":
      return processDecodedOf(decoding, outcome);
    case "workflow":
      return workflowDecodedOf(decoding, outcome);
    case "document":
      return documentDecodedOf(decoding, outcome);
    case "elapsed":
      return elapsedDecodedOf(decoding, outcome);
  }
}
