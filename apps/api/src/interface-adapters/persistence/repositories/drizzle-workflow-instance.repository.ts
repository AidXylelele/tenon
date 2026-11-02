import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { Outbox } from '@nestjs/outbox';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { WorkflowInstanceRepository } from '../../../application/automation/instances/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { StaleWriteError } from '../../../domain/errors.js';
import type { DrizzleTx } from '../interfaces.js';
import { DomainEventMapper } from '../mappers/domain-event.mapper.js';
import { TaskInstanceMapper } from '../mappers/task-instance.mapper.js';
import { WorkflowInstanceMapper } from '../mappers/workflow-instance.mapper.js';
import {
  taskInstance as tasks,
  workflowInstance as instances,
} from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowInstanceRepository implements WorkflowInstanceRepository {
  private static readonly BATCH = 1_000;

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

    const active = await this.txHost.tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.instanceId, id), isNull(tasks.endedAt)))
      .orderBy(asc(tasks.execution));
    const loaded = active.map((task) => TaskInstanceMapper.toEntity(task));
    return WorkflowInstanceMapper.toEntity(row, loaded);
  }

  @Transactional(Propagation.Mandatory)
  async save(instance: WorkflowInstance): Promise<void> {
    if (!instance.changed) return;

    await this.#saveInstance(instance);
    const rows = instance.tasks.map((task) =>
      TaskInstanceMapper.toRow(task, instance.id),
    );

    // PostgreSQL binds at most 65,535 parameters per statement, so rows go in batches.
    for (
      let start = 0;
      start < rows.length;
      start += DrizzleWorkflowInstanceRepository.BATCH
    ) {
      const end = start + DrizzleWorkflowInstanceRepository.BATCH;
      const batch = rows.slice(start, end);
      await this.txHost.tx
        .insert(tasks)
        .values(batch)
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            phase: sql`excluded.phase`,
            output: sql`excluded.output`,
            error: sql`excluded.error`,
            retries: sql`excluded.retries`,
            progress: sql`excluded.progress`,
            endedAt: sql`excluded.ended_at`,
          },
        });
    }

    const events = instance.takeDomainEvents();
    const entries = events.map((event) => DomainEventMapper.toEntry(event));

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);
  }

  async #saveInstance(instance: WorkflowInstance): Promise<void> {
    const row = WorkflowInstanceMapper.toRow(instance);
    const nextVersion = instance.version + 1;
    const upsert = this.txHost.tx
      .insert(instances)
      .values({ ...row, version: nextVersion })
      .onConflictDoUpdate({
        target: instances.id,
        set: {
          phase: sql`excluded.phase`,
          output: sql`excluded.output`,
          error: sql`excluded.error`,
          context: sql`excluded.context`,
          endedAt: sql`excluded.ended_at`,
          sequence: sql`excluded.sequence`,
          executions: sql`excluded.executions`,
          version: sql`excluded.version`,
        },
        setWhere: eq(instances.version, instance.version),
      })
      .returning({ id: instances.id });

    const saved = await upsert;

    if (saved.length === 0) throw new StaleWriteError();
  }
}
