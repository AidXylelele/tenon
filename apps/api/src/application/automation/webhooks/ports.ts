import type { Webhook } from "../../../domain/automation/webhooks/webhook.js";
import type { WebhookToken } from "../../../domain/automation/webhooks/webhook-token.js";

export abstract class WebhookRepository {
  abstract findById(id: string): Promise<Webhook | null>;
  abstract findByToken(token: WebhookToken): Promise<Webhook | null>;
  abstract add(webhook: Webhook): Promise<void>;
  abstract remove(webhook: Webhook): Promise<void>;
}
