import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, ne, sql } from 'drizzle-orm';
import {
  type FieldShape,
  type Item,
  NodeSamples,
} from '../../../application/interfaces.js';
import { FieldShapes } from '../../node-types/field-shapes.js';
import type { DrizzleTx } from '../../interfaces.js';
import { nodeSample as samples } from '../schema/index.js';

@Injectable()
export class DrizzleNodeSamples extends NodeSamples {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {
    super();
  }

  async pin(
    workflowId: string,
    nodeId: string,
    items: readonly Item[],
  ): Promise<void> {
    const row = {
      workflowId,
      nodeId,
      pinned: [...items],
      fields: FieldShapes.of(items),
      fieldsSource: 'pin' as const,
      updatedAt: new Date(),
    };
    await this.txHost.tx
      .insert(samples)
      .values(row)
      .onConflictDoUpdate({
        target: [samples.workflowId, samples.nodeId],
        set: {
          pinned: row.pinned,
          fields: row.fields,
          fieldsSource: row.fieldsSource,
          updatedAt: row.updatedAt,
        },
      });
  }

  async unpin(workflowId: string, nodeId: string): Promise<void> {
    await this.txHost.tx
      .delete(samples)
      .where(
        and(eq(samples.workflowId, workflowId), eq(samples.nodeId, nodeId)),
      );
  }

  async pinned(workflowId: string, nodeId: string): Promise<readonly Item[]> {
    const [row] = await this.txHost.tx
      .select({ pinned: samples.pinned })
      .from(samples)
      .where(
        and(eq(samples.workflowId, workflowId), eq(samples.nodeId, nodeId)),
      );
    return row?.pinned ?? [];
  }

  async recordFields(
    workflowId: string,
    nodeId: string,
    fields: readonly FieldShape[],
  ): Promise<void> {
    const now = new Date();
    await this.txHost.tx
      .insert(samples)
      .values({
        workflowId,
        nodeId,
        pinned: null,
        fields: [...fields],
        fieldsSource: 'test-run',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [samples.workflowId, samples.nodeId],
        set: {
          fields: sql`excluded.fields`,
          fieldsSource: sql`excluded.fields_source`,
          updatedAt: sql`excluded.updated_at`,
        },
        setWhere: ne(samples.fieldsSource, 'pin'),
      });
  }
}
