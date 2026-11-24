import type { Failure } from "interpreter";
import { TransportFailure } from "./enums.js";

export class TransportFault extends Error {
  constructor(
    readonly reason: TransportFailure,
    detail: string,
    options?: ErrorOptions,
  ) {
    super(detail, options);
  }

  failure(): Failure {
    switch (this.reason) {
      case TransportFailure.Expired:
        return { kind: "expired" };
      case TransportFailure.Unreachable:
        return { kind: "unreachable", detail: this.message };
      case TransportFailure.Unauthenticated:
        return { kind: "unauthenticated", detail: this.message };
      case TransportFailure.Misconfigured:
        return { kind: "misconfigured", detail: this.message };
    }
  }
}
