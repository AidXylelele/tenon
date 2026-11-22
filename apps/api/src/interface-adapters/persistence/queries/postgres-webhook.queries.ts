import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { desc } from "drizzle-orm";
import type { WebhookQueries } from "../../../application/automation/webhooks/queries.js";
import type { WebhookView } from "../../../application/automation/webhooks/interfaces.js";
import type { Transaction } from "../interfaces.js";
import { webhook as webhooks } from "../schema/index.js";

@Injectable()
export class PostgresWebhookQueries implements WebhookQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

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
