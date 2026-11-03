import type { JsonObject, JsonValue } from '../json.js';
import type { WebhookToken } from './webhook-token.js';

export interface WebhookProps {
  readonly id: string;
  readonly name: string;
  readonly eventType: string;
  readonly tokenFingerprint: string;
  readonly createdAt: Date;
}

export interface NewWebhook {
  readonly name: string;
  readonly eventType: string;
  readonly token: WebhookToken;
  readonly now: Date;
}

// A request to a webhook's URL: its body (text when it is not JSON), query and headers (the
// caller's credentials already left out), and the caller's idempotency key, if any.
export interface WebhookCall {
  readonly body: JsonValue;
  readonly query: JsonObject;
  readonly headers: Readonly<Record<string, string>>;
  readonly key: string | null;
}

// The event a call becomes: one of the webhook's type, from the webhook as its source, and
// identified by the caller's key, so that a repeated call is the same event (US5 AS4).
export interface WebhookEvent {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly data: JsonObject;
  readonly at: Date;
}
