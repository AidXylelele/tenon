import type { WebhookCall } from "../../../domain/automation/webhooks/interfaces.js";
import type { WebhookToken } from "../../../domain/automation/webhooks/webhook-token.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";

export interface CreateWebhookCommand {
  readonly name: string;
  readonly eventType: string;
}

export interface DeleteWebhookCommand {
  readonly webhookId: string;
}

export interface ReceiveWebhookCallCommand {
  readonly token: WebhookToken;
  readonly call: WebhookCall;
}

export type WebhookResult = Result<void, Missing>;

export interface WebhookView {
  readonly id: string;
  readonly name: string;
  readonly eventType: string;
  readonly createdAt: Date;
}

export interface CreatedWebhook extends WebhookView {
  readonly token: string;
}
