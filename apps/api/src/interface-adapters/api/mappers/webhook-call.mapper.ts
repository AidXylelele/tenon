import type { IncomingHttpHeaders } from 'node:http';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { WebhookCall } from '../../../domain/automation/webhooks/interfaces.js';

// A request to a webhook's URL as the domain reads it: a JSON body as parsed, any other as the
// text it was, repeated headers and query parameters as lists.
export class WebhookCallMapper {
  private static readonly KEY = 'idempotency-key';

  static toCall(
    body: unknown,
    query: Record<string, unknown>,
    headers: IncomingHttpHeaders,
  ): WebhookCall {
    const parsed = (body ?? null) as JsonValue;
    const parameters = query as JsonObject;
    const flattened: Record<string, string> = {};

    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue;

      flattened[name] = typeof value === 'string' ? value : value.join(', ');
    }

    const key = flattened[WebhookCallMapper.KEY] ?? null;
    return { body: parsed, query: parameters, headers: flattened, key };
  }
}
