import { Injectable } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { WebhookCall } from "../../../domain/automation/webhooks/interfaces.js";

@Injectable()
export class WebhookCallMapper {
  private static readonly KEY = "idempotency-key";
  private static readonly CREDENTIALS = new Set(["authorization", "cookie"]);

  toCall(
    body: unknown,
    query: Record<string, unknown>,
    headers: IncomingHttpHeaders,
  ): WebhookCall {
    const parsed = (body ?? null) as JsonValue;
    const parameters = query as JsonObject;
    const flattened = this.#flattenedOf(headers);
    const key = flattened[WebhookCallMapper.KEY] ?? null;
    return { body: parsed, query: parameters, headers: flattened, key };
  }

  #flattenedOf(headers: IncomingHttpHeaders): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [name, value] of Object.entries(headers)) {
      const lowered = name.toLowerCase();

      if (value === undefined || WebhookCallMapper.CREDENTIALS.has(lowered))
        continue;

      flattened[lowered] = typeof value === "string" ? value : value.join(", ");
    }

    return flattened;
  }
}
