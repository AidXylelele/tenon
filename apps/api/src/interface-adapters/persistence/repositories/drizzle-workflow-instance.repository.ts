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
import {
  InstanceNotFoundError,
  StaleWriteError,
} from '../../../domain/errors.js';
import { Batches } from '../batches.js';
import type { DrizzleTx } from '../interfaces.js';
import { DomainEventMapper } from '../mappers/domain-event.mapper.js';
import { TaskInstanceMapper } from '../mappers/task-instance.mapper.js';
import { WorkflowInstanceMapper } from '../mappers/workflow-instance.mapper.js';
import {
  taskInstance as tasks,
  workflowInstance as instances,
} from '../schema/index.js';
import { DrizzleEventRepository } from './drizzle-event.repository.js';

@Injectable()
export class DrizzleWorkflowInstanceRepository implements WorkflowInstanceRepository {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly outbox: Outbox,
    private readonly events: DrizzleEventRepository,
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

  async get(id: string): Promise<WorkflowInstance> {
    const instance = await this.find(id);

    if (instance === null) throw new InstanceNotFoundError();

    return instance;
  }

  @Transactional(Propagation.Mandatory)
  async save(instance: WorkflowInstance): Promise<void> {
    if (!instance.changed) return;

    await this.#saveInstance(instance);
    const rows = instance.tasks.map((task) =>
      TaskInstanceMapper.toRow(task, instance.id),
    );

    for (const batch of Batches.of(rows))
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

    const produced = instance.takeProducedEvents();
    await this.events.addAll(produced);
    const domainEvents = instance.takeDomainEvents();
    const entries = domainEvents.map((event) =>
      DomainEventMapper.toEntry(event),
    );

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
          rounds: sql`excluded.rounds`,
          version: sql`excluded.version`,
        },
        setWhere: eq(instances.version, instance.version),
      })
      .returning({ id: instances.id });

    const saved = await upsert;

    if (saved.length === 0) throw new StaleWriteError();
  }
}
