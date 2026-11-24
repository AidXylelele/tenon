import { Injectable } from "@nestjs/common";
import { HttpNetworkError } from "@nestjs/http-client";
import { ResilienceError, ResilienceTimeoutError } from "@nestjs/resilience";
import { TransportFailure } from "../../interface-adapters/http/enums.js";
import { TransportFault } from "../../interface-adapters/http/transport-fault.error.js";
import { RefusalCode } from "./enums.js";

@Injectable()
export class TransportFaults {
  private static readonly INVALID_REQUEST =
    "The request cannot be sent: its URI, method, headers or body are not valid";
  private static readonly CERTIFICATE_REFUSED =
    "The service's TLS certificate was refused";
  private static readonly CLOSED_EARLY =
    "The connection closed before the service answered";
  private static readonly EXPIRED = "The service did not answer in time";
  private static readonly UNRESOLVED = "The host name could not be resolved";
  private static readonly UNREACHABLE = "The service could not be reached";
  private static readonly NETWORK_REASONS = new Map<string, string>([
    ["ENOTFOUND", TransportFaults.UNRESOLVED],
    ["EAI_AGAIN", TransportFaults.UNRESOLVED],
    ["ECONNREFUSED", "The service refused the connection"],
    ["ECONNRESET", TransportFaults.CLOSED_EARLY],
    ["EPIPE", TransportFaults.CLOSED_EARLY],
    ["UND_ERR_SOCKET", TransportFaults.CLOSED_EARLY],
    ["UND_ERR_CLOSED", TransportFaults.CLOSED_EARLY],
    ["ETIMEDOUT", "The connection timed out"],
    ["UND_ERR_CONNECT_TIMEOUT", "The connection timed out"],
    ["EHOSTUNREACH", "The host is unreachable"],
    ["ENETUNREACH", "The network is unreachable"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", TransportFaults.CERTIFICATE_REFUSED],
    ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", TransportFaults.CERTIFICATE_REFUSED],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", TransportFaults.CERTIFICATE_REFUSED],
    ["SELF_SIGNED_CERT_IN_CHAIN", TransportFaults.CERTIFICATE_REFUSED],
    ["ERR_TLS_CERT_ALTNAME_INVALID", TransportFaults.CERTIFICATE_REFUSED],
  ]);
  private static readonly INVALID_CODES: readonly string[] = [
    "UND_ERR_INVALID_ARG",
    "UND_ERR_NOT_SUPPORTED",
    "ERR_INVALID_URL",
    "ERR_INVALID_HTTP_TOKEN",
    "ERR_INVALID_CHAR",
  ];

  of(error: unknown, signal: AbortSignal): TransportFault {
    if (error instanceof TransportFault) return error;

    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return this.expired();

    if (error instanceof ResilienceError) throw error;

    const fault = this.classified(error);

    if (fault === null) throw error;

    return fault;
  }

  classified(error: unknown): TransportFault | null {
    const cause = this.#causeOf(error);

    if (cause instanceof TypeError)
      return this.#misconfigured(TransportFaults.INVALID_REQUEST);

    const code: unknown =
      cause instanceof Error ? Reflect.get(cause, "code") : undefined;
    const detail = cause instanceof Error ? cause.message : "";

    switch (code) {
      case RefusalCode.Address:
      case RefusalCode.ResponseSize:
        return this.#unreachable(detail);
    }

    if (typeof code === "string") return this.#networkFaultOf(code);

    if (error instanceof HttpNetworkError)
      return this.#unreachable(TransportFaults.UNREACHABLE);

    return null;
  }

  expired(): TransportFault {
    return new TransportFault(
      TransportFailure.Expired,
      TransportFaults.EXPIRED,
    );
  }

  #causeOf(error: unknown): unknown {
    if (error instanceof HttpNetworkError) return error.cause;

    const wrapped = error instanceof TypeError && error.cause !== undefined;
    return wrapped ? error.cause : error;
  }

  #networkFaultOf(code: string): TransportFault {
    const invalid = TransportFaults.INVALID_CODES.includes(code);

    if (invalid) return this.#misconfigured(TransportFaults.INVALID_REQUEST);

    const certificate = code.startsWith("CERT_");

    if (certificate)
      return this.#unreachable(TransportFaults.CERTIFICATE_REFUSED);

    const detail =
      TransportFaults.NETWORK_REASONS.get(code) ?? TransportFaults.UNREACHABLE;
    return this.#unreachable(detail);
  }

  #unreachable(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Unreachable, detail);
  }

  #misconfigured(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Misconfigured, detail);
  }
}
