import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Failure } from "interpreter";
import { ImportRefusal } from "../../application/automation/imports/enums.js";
import type {
  ImportFailure,
  ImportResult,
} from "../../application/automation/imports/interfaces.js";
import type { ImportFetcher } from "../../application/automation/imports/ports.js";
import { ResourceGateway } from "./resource.gateway.js";

@Injectable()
export class ImportGateway implements ImportFetcher {
  private static readonly IMPORT_EXPIRED =
    "The import's server did not answer within the time limit";

  constructor(private readonly resources: ResourceGateway) {}

  async fetch(uri: string): Promise<ImportResult> {
    const endpoint = { uri, authentication: null };
    const resource = { name: null, endpoint };
    const signal = new AbortController().signal;
    const idempotencyKey = randomUUID();
    const step = { idempotencyKey, signal, secrets: {} };
    const fetched = await this.resources.text(resource, step);

    if (fetched.kind === "text")
      return { ok: true, value: { text: fetched.text } };

    const failure = this.#importFailureOf(fetched);
    return { ok: false, failure };
  }

  #importFailureOf(failure: Failure): ImportFailure {
    switch (failure.kind) {
      case "expired":
        return {
          refusal: ImportRefusal.Expired,
          detail: ImportGateway.IMPORT_EXPIRED,
        };
      case "unreachable":
        return { refusal: ImportRefusal.Unreachable, detail: failure.detail };
      case "rejected":
        return { refusal: ImportRefusal.Rejected, detail: failure.detail };
      case "unauthenticated":
        return {
          refusal: ImportRefusal.Unauthenticated,
          detail: failure.detail,
        };
      case "forbidden":
      case "misconfigured":
        return { refusal: ImportRefusal.Misconfigured, detail: failure.detail };
    }
  }
}
