import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq } from 'drizzle-orm';
import type { WebhookEndpointRepository } from '../../../application/interfaces.js';
import { WebhookEndpointConflictError } from '../../../domain/errors.js';
import type { WebhookEndpoint } from '../../../domain/webhook-endpoint.js';
import type { DrizzleTx } from '../../interfaces.js';
import { WebhookEndpointMapper } from '../mappers/webhook-endpoint.mapper.js';
import { webhookEndpoint as endpoints } from '../schema/index.js';

@Injectable()
export class DrizzleWebhookEndpointRepository implements WebhookEndpointRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(endpoint: WebhookEndpoint): Promise<void> {
    const row = WebhookEndpointMapper.toRow(endpoint);
    const inserted = await this.txHost.tx
      .insert(endpoints)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: endpoints.id });

    if (inserted.length === 0) throw new WebhookEndpointConflictError();
  }

  async update(endpoint: WebhookEndpoint): Promise<void> {
    const row = WebhookEndpointMapper.toRow(endpoint);
    const nextVersion = endpoint.version + 1;
    const updated = await this.txHost.tx
      .update(endpoints)
      .set({ ...row, version: nextVersion })
      .where(
        and(
          eq(endpoints.id, endpoint.id),
          eq(endpoints.version, endpoint.version),
        ),
      )
      .returning({ id: endpoints.id });

    if (updated.length === 0) throw new WebhookEndpointConflictError();
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(endpoints)
      .where(eq(endpoints.id, id));

    if (!row) return null;

    return WebhookEndpointMapper.toEntity(row);
  }

  async findByNode(
    workflowId: string,
    nodeId: string,
  ): Promise<WebhookEndpoint | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(endpoints)
      .where(
        and(eq(endpoints.workflowId, workflowId), eq(endpoints.nodeId, nodeId)),
      );

    if (!row) return null;

    return WebhookEndpointMapper.toEntity(row);
  }

  async listByWorkflow(workflowId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.txHost.tx
      .select()
      .from(endpoints)
      .where(eq(endpoints.workflowId, workflowId))
      .orderBy(asc(endpoints.createdAt), asc(endpoints.id));
    return rows.map((row) => WebhookEndpointMapper.toEntity(row));
  }
}
