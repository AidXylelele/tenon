import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { desc } from 'drizzle-orm';
import type {
  WebhookQueries,
  WebhookView,
} from '../../../application/automation/webhooks/queries.js';
import type { DrizzleTx } from '../interfaces.js';
import { webhook as webhooks } from '../schema/index.js';

@Injectable()
export class DrizzleWebhookQueries implements WebhookQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  list(): Promise<WebhookView[]> {
    return this.txHost.tx
      .select({
        id: webhooks.id,
        name: webhooks.name,
        eventType: webhooks.eventType,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .orderBy(desc(webhooks.createdAt));
  }
}
