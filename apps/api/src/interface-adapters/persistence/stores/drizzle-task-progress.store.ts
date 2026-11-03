import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { sql } from 'drizzle-orm';
import type {
  TaskProgress,
  TaskRecord,
} from '../../../application/automation/instances/ports.js';
import { EventOrigin } from '../../../application/automation/events/enums.js';
import type { DrizzleTx } from '../interfaces.js';
import { LifecycleEventMapper } from '../mappers/lifecycle-event.mapper.js';
import { DrizzleInstanceNames } from '../queries/drizzle-instance-names.query.js';
import { DrizzleEventStore } from './drizzle-event.store.js';
import { taskProgress as progress } from '../schema/index.js';

// One row per execution: a start writes it running, an end completes it (or writes it whole
// when the task ended at once, skipped or faulted before it began).
@Injectable()
export class DrizzleTaskProgressStore implements TaskProgress {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly events: DrizzleEventStore,
    private readonly names: DrizzleInstanceNames,
  ) {}

  async started(instanceId: string, task: TaskRecord): Promise<void> {
    await this.txHost.tx
      .insert(progress)
      .values({
        instanceId,
        execution: task.execution,
        reference: task.reference,
        name: task.name,
        status: task.status,
        input: task.input,
        startedAt: task.at,
      })
      .onConflictDoUpdate({
        target: [progress.instanceId, progress.execution],
        set: { status: sql`excluded.status`, error: null, endedAt: null },
      });
    await this.#told(instanceId, task);
  }

  async ended(instanceId: string, task: TaskRecord): Promise<void> {
    await this.txHost.tx
      .insert(progress)
      .values({
        instanceId,
        execution: task.execution,
        reference: task.reference,
        name: task.name,
        status: task.status,
        input: task.input,
        output: task.output,
        error: task.error,
        startedAt: task.at,
        endedAt: task.at,
      })
      .onConflictDoUpdate({
        target: [progress.instanceId, progress.execution],
        set: {
          status: sql`excluded.status`,
          output: sql`excluded.output`,
          error: sql`excluded.error`,
          endedAt: sql`excluded.ended_at`,
        },
      });
    await this.#told(instanceId, task);
  }

  // The task's lifecycle event, accepted as any other event.
  async #told(instanceId: string, task: TaskRecord): Promise<void> {
    const names = await this.names.of(instanceId);

    if (names === null) return;

    const lifecycle = LifecycleEventMapper.ofTask(instanceId, names, task);

    if (lifecycle !== null)
      await this.events.accept(lifecycle, EventOrigin.Lifecycle, instanceId);
  }
}
