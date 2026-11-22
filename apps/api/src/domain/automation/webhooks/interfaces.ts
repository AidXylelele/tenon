import type { JsonObject, JsonValue } from "../interfaces.js";
import type { WebhookToken } from "./webhook-token.js";

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

export interface WebhookCall {
  readonly body: JsonValue;
  readonly query: JsonObject;
  readonly headers: Readonly<Record<string, string>>;
  readonly key: string | null;
}

export interface WebhookEvent {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly data: JsonObject;
  readonly at: Date;
}
