import { Webhook } from '../../../domain/automation/webhooks/webhook.js';
import type { WebhookRow } from '../interfaces.js';

export class WebhookMapper {
  static toRow(webhook: Webhook): WebhookRow {
    return {
      id: webhook.id,
      name: webhook.name,
      eventType: webhook.eventType,
      tokenFingerprint: webhook.tokenFingerprint,
      createdAt: webhook.createdAt,
    };
  }

  static toEntity(row: WebhookRow): Webhook {
    return new Webhook({
      id: row.id,
      name: row.name,
      eventType: row.eventType,
      tokenFingerprint: row.tokenFingerprint,
      createdAt: row.createdAt,
    });
  }
}
