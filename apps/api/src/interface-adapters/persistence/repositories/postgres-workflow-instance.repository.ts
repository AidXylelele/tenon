import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import type { WorkflowInstanceRepository } from "../../../application/automation/instances/ports.js";
import {
  TriggerKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import type { Transaction } from "../interfaces.js";
import { WorkflowInstanceMapper } from "../mappers/workflow-instance.mapper.js";
import {
  listener as listeners,
  receiver as receivers,
  workflowInstance as instances,
} from "../schema/index.js";
import { PostgresTaskValueStore } from "../stores/postgres-task-value.store.js";

@Injectable()
export class PostgresWorkflowInstanceRepository implements WorkflowInstanceRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly taskValues: PostgresTaskValueStore,
    private readonly workflowInstanceMapper: WorkflowInstanceMapper,
  ) {}

  async find(id: string): Promise<WorkflowInstance | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(instances)
      .where(eq(instances.id, id));

    if (!row) return null;

    return this.workflowInstanceMapper.toEntity(row);
  }

  async findChild(
    parentId: string,
    effectId: string,
  ): Promise<WorkflowInstance | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(instances)
      .where(
        and(
          eq(instances.originId, parentId),
          eq(instances.originEffectId, effectId),
        ),
      );

    if (!row) return null;

    return this.workflowInstanceMapper.toEntity(row);
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
    return rows.map((row) => this.workflowInstanceMapper.toEntity(row));
  }

  async findEndedChildren(
    parent: WorkflowInstance,
  ): Promise<WorkflowInstance[]> {
    const awaited = parent.awaited.map((effect) => effect.id);

    if (awaited.length === 0) return [];

    const rows = await this.txHost.tx
      .select()
      .from(instances)
      .where(
        and(
          eq(instances.originId, parent.id),
          eq(instances.trigger, TriggerKind.Parent),
          inArray(instances.originEffectId, awaited),
          isNotNull(instances.endedAt),
        ),
      );
    return rows.map((row) => this.workflowInstanceMapper.toEntity(row));
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

  async save(instance: WorkflowInstance): Promise<void> {
    const row = this.workflowInstanceMapper.toRow(instance);
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
          runState: sql`excluded.run_state`,
          runFormat: sql`excluded.run_format`,
          programFingerprint: sql`excluded.program_fingerprint`,
          runWaits: sql`excluded.run_waits`,
          cancelReason: sql`excluded.cancel_reason`,
          version: sql`excluded.version`,
        },
        setWhere: eq(instances.version, instance.version),
      })
      .returning({ id: instances.id });

    if (saved.length === 0) throw new StaleWriteError();

    await this.#listen(instance);
    await this.#receive(instance);
    const now = new Date();
    await this.taskValues.keep(instance, now);
  }

  async remove(instance: WorkflowInstance): Promise<void> {
    await this.txHost.tx.delete(instances).where(eq(instances.id, instance.id));
  }

  async #receive(instance: WorkflowInstance): Promise<void> {
    const receiving = instance.receiving;
    const executions = receiving.map((receive) => receive.execution);
    const closed = and(
      eq(receivers.instanceId, instance.id),
      notInArray(receivers.execution, executions),
    );
    await this.txHost.tx.delete(receivers).where(closed);

    const waits = instance.waits.filter(
      (wait) => wait.kind === WaitKind.Message,
    );

    for (const receive of receiving) {
      const closesAt =
        receive.closesAt === null ? null : new Date(receive.closesAt);
      const wait = waits.find((each) => each.execution === receive.execution);
      const awaiting = wait?.position ?? null;
      await this.txHost.tx
        .insert(receivers)
        .values({
          instanceId: instance.id,
          execution: receive.execution,
          request: receive.request,
          closesAt,
          awaiting,
        })
        .onConflictDoUpdate({
          target: [receivers.instanceId, receivers.execution],
          set: {
            request: sql`excluded.request`,
            closesAt: sql`excluded.closes_at`,
            awaiting: sql`excluded.awaiting`,
          },
        });
    }
  }

  async #listen(instance: WorkflowInstance): Promise<void> {
    const listening = instance.listening;
    const executions = listening.map((listen) => listen.execution);
    const closed = and(
      eq(listeners.instanceId, instance.id),
      notInArray(listeners.execution, executions),
    );
    await this.txHost.tx.delete(listeners).where(closed);
    const since = new Date();

    for (const listen of listening)
      await this.txHost.tx
        .insert(listeners)
        .values({
          instanceId: instance.id,
          execution: listen.execution,
          effectId: listen.effectId,
          stream: listen.stream,
          position: listen.position,
          open: listen.open,
          since,
        })
        .onConflictDoUpdate({
          target: [listeners.instanceId, listeners.execution],
          set: {
            effectId: sql`excluded.effect_id`,
            stream: sql`excluded.stream`,
            position: sql`excluded.position`,
            open: sql`excluded.open`,
          },
        });
  }
}
