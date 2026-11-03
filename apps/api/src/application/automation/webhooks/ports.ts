import type { WebhookCall } from '../../../domain/automation/webhooks/interfaces.js';
import type { Webhook } from '../../../domain/automation/webhooks/webhook.js';
import type { WebhookToken } from '../../../domain/automation/webhooks/webhook-token.js';
import type { Result } from '../../../domain/result.js';
import type { Missing } from '../enums.js';

export interface CreateWebhookCommand {
  readonly name: string;
  readonly eventType: string;
}

// The webhook and its token, which is never shown again.
export interface CreatedWebhook {
  readonly webhook: Webhook;
  readonly token: WebhookToken;
}

export interface DeleteWebhookCommand {
  readonly webhookId: string;
}

export interface ReceiveWebhookCallCommand {
  readonly token: WebhookToken;
  readonly call: WebhookCall;
}

export type WebhookResult = Result<undefined, Missing>;

export abstract class WebhookRepository {
  abstract findById(id: string): Promise<Webhook | null>;
  abstract findByToken(token: WebhookToken): Promise<Webhook | null>;
  abstract add(webhook: Webhook): Promise<void>;
  abstract remove(webhook: Webhook): Promise<void>;
}
