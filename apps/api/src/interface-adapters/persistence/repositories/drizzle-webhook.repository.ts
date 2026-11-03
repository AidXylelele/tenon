import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { WebhookRepository } from '../../../application/automation/webhooks/ports.js';
import type { Webhook } from '../../../domain/automation/webhooks/webhook.js';
import type { WebhookToken } from '../../../domain/automation/webhooks/webhook-token.js';
import type { DrizzleTx } from '../interfaces.js';
import { WebhookMapper } from '../mappers/webhook.mapper.js';
import { webhook as webhooks } from '../schema/index.js';

// A webhook is written once and removed whole: nothing of it changes in between.
@Injectable()
export class DrizzleWebhookRepository implements WebhookRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async findById(id: string): Promise<Webhook | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id));

    if (!row) return null;

    return WebhookMapper.toEntity(row);
  }

  async findByToken(token: WebhookToken): Promise<Webhook | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(webhooks)
      .where(eq(webhooks.tokenFingerprint, token.fingerprint));

    if (!row) return null;

    return WebhookMapper.toEntity(row);
  }

  async add(webhook: Webhook): Promise<void> {
    const row = WebhookMapper.toRow(webhook);
    await this.txHost.tx.insert(webhooks).values(row);
  }

  async remove(webhook: Webhook): Promise<void> {
    await this.txHost.tx.delete(webhooks).where(eq(webhooks.id, webhook.id));
  }
}
