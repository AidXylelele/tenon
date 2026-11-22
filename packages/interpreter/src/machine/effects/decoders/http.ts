import type {
  EffectOutcome,
  JsonValue,
  RespondedHttpOutcome,
  RevealedAuthorization,
  SentHttpRequest,
} from "../../../api/index.js";
import type { HttpDecoder } from "../../../core/index.js";
import { type JsonOf, Raised } from "../../../runtime/index.js";
import type { HttpOutputMode } from "../../../standard/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, httpKinds } from "./kinds.js";

const firstAccepted = 200;
const lastSuccessful = 299;
const lastRedirection = 399;

export function httpDecodedOf(
  decoding: HttpDecoder,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(httpKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  checkStatus(decoding, outcome);

  const value = outputOf(outcome, decoding.output);
  const authorization: JsonOf<RevealedAuthorization | null> =
    outcome.authorization;

  return { value, authorization };
}

function checkStatus(
  decoding: HttpDecoder,
  response: RespondedHttpOutcome,
): void {
  const status = response.statusCode;
  const last = lastAcceptedOf(decoding);
  const accepted = status >= firstAccepted && status <= last;

  if (accepted) {
    return;
  }

  const request = response.request;
  const shown = String(status);
  const detail = `${request.method} ${request.uri} answered ${shown}.`;
  throw Raised.withStatus({ name: "communication", detail, status });
}

function lastAcceptedOf(decoding: HttpDecoder): number {
  if (decoding.redirect) {
    return lastRedirection;
  }

  return lastSuccessful;
}

function outputOf(
  response: RespondedHttpOutcome,
  output: HttpOutputMode,
): JsonValue {
  switch (output) {
    case "raw":
    case "content":
      return response.content;
    case "response": {
      const request: JsonOf<SentHttpRequest> = response.request;
      return {
        request,
        statusCode: response.statusCode,
        headers: response.headers,
        content: response.content,
      };
    }
  }
}
