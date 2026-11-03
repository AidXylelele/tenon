import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { Outbox } from '@nestjs/outbox';
import { eq, sql } from 'drizzle-orm';
import type { WorkflowInstanceRepository } from '../../../application/automation/instances/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { StaleWriteError } from '../../../domain/errors.js';
import type { DrizzleTx } from '../interfaces.js';
import { WorkflowInstanceMapper } from '../mappers/workflow-instance.mapper.js';
import { workflowInstance as instances } from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowInstanceRepository implements WorkflowInstanceRepository {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly outbox: Outbox,
  ) {}

  async find(id: string): Promise<WorkflowInstance | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(instances)
      .where(eq(instances.id, id));

    if (!row) return null;

    return WorkflowInstanceMapper.toEntity(row);
  }

  // An upsert fenced by the instance's version; what the engine must learn goes to the outbox in
  // the same transaction.
  @Transactional(Propagation.Mandatory)
  async save(instance: WorkflowInstance): Promise<void> {
    const row = WorkflowInstanceMapper.toRow(instance);
    const nextVersion = instance.version + 1;
    const saved = await this.txHost.tx
      .insert(instances)
      .values({ ...row, version: nextVersion })
      .onConflictDoUpdate({
        target: instances.id,
        set: {
          phase: sql`excluded.phase`,
          output: sql`excluded.output`,
          error: sql`excluded.error`,
          startedAt: sql`excluded.started_at`,
          endedAt: sql`excluded.ended_at`,
          version: sql`excluded.version`,
        },
        setWhere: eq(instances.version, instance.version),
      })
      .returning({ id: instances.id });

    if (saved.length === 0) throw new StaleWriteError();

    await this.#told(instance);
  }

  @Transactional(Propagation.Mandatory)
  async remove(instance: WorkflowInstance): Promise<void> {
    await this.txHost.tx.delete(instances).where(eq(instances.id, instance.id));
    await this.#told(instance);
  }

  async #told(instance: WorkflowInstance): Promise<void> {
    const entries = instance.events.map((event) => ({
      topic: event.kind,
      key: event.instanceId,
      payload: { instanceId: event.instanceId },
    }));

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);

    instance.clearEvents();
  }
}
