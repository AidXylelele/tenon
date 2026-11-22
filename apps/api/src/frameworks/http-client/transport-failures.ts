import { Injectable } from "@nestjs/common";
import { HttpNetworkError } from "@nestjs/http-client";
import { ResilienceError, ResilienceTimeoutError } from "@nestjs/resilience";
import type { Failure } from "interpreter";
import { AddressPolicy } from "./address-policy.js";
import { AuthorizationServer } from "./authorization-server.js";
import { ResponseSizeLimit } from "./response-size-limit.js";

const INVALID_REQUEST =
  "The request cannot be sent: its URI, method, headers or body are not valid";

const CERTIFICATE_REFUSED = "The service's TLS certificate was refused";

const CLOSED_EARLY = "The connection closed before the service answered";

const UNRESOLVED = "The host name could not be resolved";

const UNREACHABLE = "The service could not be reached";

const NETWORK_REASONS = new Map<string, string>([
  ["ENOTFOUND", UNRESOLVED],
  ["EAI_AGAIN", UNRESOLVED],
  ["ECONNREFUSED", "The service refused the connection"],
  ["ECONNRESET", CLOSED_EARLY],
  ["EPIPE", CLOSED_EARLY],
  ["UND_ERR_SOCKET", CLOSED_EARLY],
  ["UND_ERR_CLOSED", CLOSED_EARLY],
  ["ETIMEDOUT", "The connection timed out"],
  ["UND_ERR_CONNECT_TIMEOUT", "The connection timed out"],
  ["EHOSTUNREACH", "The host is unreachable"],
  ["ENETUNREACH", "The network is unreachable"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", CERTIFICATE_REFUSED],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", CERTIFICATE_REFUSED],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", CERTIFICATE_REFUSED],
  ["SELF_SIGNED_CERT_IN_CHAIN", CERTIFICATE_REFUSED],
  ["ERR_TLS_CERT_ALTNAME_INVALID", CERTIFICATE_REFUSED],
]);

@Injectable()
export class TransportFailures {
  of(error: unknown, signal: AbortSignal): Failure {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    const failure = this.classified(error);

    if (failure === null) throw error;

    return failure;
  }

  classified(error: unknown): Failure | null {
    const cause = this.#causeOf(error);

    if (cause instanceof TypeError)
      return { kind: "misconfigured", detail: INVALID_REQUEST };

    const code: unknown =
      cause instanceof Error ? Reflect.get(cause, "code") : undefined;
    const detail = cause instanceof Error ? cause.message : "";

    switch (code) {
      case AuthorizationServer.REFUSED:
        return { kind: "unauthenticated", detail };
      case AddressPolicy.REFUSED:
      case ResponseSizeLimit.EXCEEDED:
        return { kind: "unreachable", detail };
    }

    if (typeof code === "string") return this.#networkFailureOf(code);

    if (error instanceof HttpNetworkError)
      return { kind: "unreachable", detail: UNREACHABLE };

    return null;
  }

  #causeOf(error: unknown): unknown {
    if (error instanceof HttpNetworkError) return error.cause;

    const wrapped = error instanceof TypeError && error.cause !== undefined;
    return wrapped ? error.cause : error;
  }

  #networkFailureOf(code: string): Failure {
    const invalid = [
      "UND_ERR_INVALID_ARG",
      "UND_ERR_NOT_SUPPORTED",
      "ERR_INVALID_URL",
      "ERR_INVALID_HTTP_TOKEN",
      "ERR_INVALID_CHAR",
    ].includes(code);

    if (invalid) return { kind: "misconfigured", detail: INVALID_REQUEST };

    if (code.startsWith("CERT_"))
      return { kind: "unreachable", detail: CERTIFICATE_REFUSED };

    const detail = NETWORK_REASONS.get(code) ?? UNREACHABLE;
    return { kind: "unreachable", detail };
  }
}
