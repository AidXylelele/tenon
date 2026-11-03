import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { Outbox } from '@nestjs/outbox';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { EventOrigin } from '../../../application/automation/events/enums.js';
import {
  InstanceEventKind,
  TriggerKind,
} from '../../../domain/automation/instances/enums.js';
import { LifecycleEventMapper } from '../mappers/lifecycle-event.mapper.js';
import { DrizzleInstanceNames } from '../queries/drizzle-instance-names.query.js';
import { DrizzleEventStore } from '../stores/drizzle-event.store.js';
import type { WorkflowInstanceRepository } from '../../../application/automation/instances/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { StaleWriteError } from '../../../domain/errors.js';
import type { DrizzleTx } from '../interfaces.js';
import { WorkflowInstanceMapper } from '../mappers/workflow-instance.mapper.js';
import { workflowInstance as instances } from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowInstanceRepository implements WorkflowInstanceRepository {
  private static readonly ENGINE = new Set<InstanceEventKind>([
    InstanceEventKind.Cancelled,
    InstanceEventKind.Resumed,
    InstanceEventKind.Deleted,
  ]);

  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly outbox: Outbox,
    private readonly events: DrizzleEventStore,
    private readonly names: DrizzleInstanceNames,
  ) {}

  async find(id: string): Promise<WorkflowInstance | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(instances)
      .where(eq(instances.id, id));

    if (!row) return null;

    return WorkflowInstanceMapper.toEntity(row);
  }

  async findAwaitedChildren(parentId: string): Promise<WorkflowInstance[]> {
    const rows = await this.txHost.tx
      .select()
      .from(instances)
      .where(
        and(
          eq(instances.originId, parentId),
          eq(instances.trigger, TriggerKind.Parent),
          isNull(instances.endedAt),
        ),
      );
    return rows.map((row) => WorkflowInstanceMapper.toEntity(row));
  }

  async hasUnendedScheduled(workflowId: string): Promise<boolean> {
    const [row] = await this.txHost.tx
      .select({ id: instances.id })
      .from(instances)
      .where(
        and(
          eq(instances.workflowId, workflowId),
          eq(instances.trigger, TriggerKind.Schedule),
          isNull(instances.endedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
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
          waiting: sql`excluded.waiting`,
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

  // The engine learns of a cancel, a resume or a delete; every change but a delete is also the
  // standard's lifecycle event, accepted as any other event.
  async #told(instance: WorkflowInstance): Promise<void> {
    const changes = instance.events;
    const entries = changes
      .filter((change) =>
        DrizzleWorkflowInstanceRepository.ENGINE.has(change.kind),
      )
      .map((change) => ({
        topic: change.kind,
        key: change.instanceId,
        payload: { instanceId: change.instanceId },
      }));

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);

    const names = changes.length > 0 ? await this.names.of(instance.id) : null;
    const at = new Date();

    for (const change of changes) {
      if (names === null) break;

      const lifecycle = LifecycleEventMapper.ofInstance(
        change.kind,
        instance,
        names,
        at,
      );

      if (lifecycle !== null)
        await this.events.accept(lifecycle, EventOrigin.Lifecycle, instance.id);
    }

    instance.clearEvents();
  }
}
