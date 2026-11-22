import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import type {
  InstanceDetail,
  InstanceFilter,
  InstancePage,
  InstancePosition,
  InstanceWait,
  PhaseCount,
  TaskOutput,
  TaskPage,
} from "../../../application/automation/instances/interfaces.js";
import type { InstanceQueries } from "../../../application/automation/instances/queries.js";
import type { Person } from "../../../application/identity/users/interfaces.js";
import {
  TaskValueKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { RunWait } from "../../../domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type {
  LifecycleEventName,
  LifecycleEventRow,
  TaskEventRow,
  TaskPosition,
  TaskValueRow,
  Transaction,
} from "../interfaces.js";
import { TaskRecordMapper } from "../mappers/task-record.mapper.js";
import { TaskValueMapper } from "../mappers/task-value.mapper.js";
import { WorkflowInstanceMapper } from "../mappers/workflow-instance.mapper.js";
import {
  event as events,
  taskValue as taskValues,
  user as users,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresInstanceQueries implements InstanceQueries {
  private static readonly OPENINGS: LifecycleEventName[] = [
    "task.started",
    "task.completed",
    "task.faulted",
    "task.cancelled",
  ];
  private static readonly FINISHES: LifecycleEventName[] = [
    "workflow.faulted",
    "workflow.cancelled",
  ];
  private static readonly TASK_EVENTS: LifecycleEventName[] = [
    ...PostgresInstanceQueries.OPENINGS,
    "task.retried",
  ];

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly workflowInstanceMapper: WorkflowInstanceMapper,
    private readonly taskRecordMapper: TaskRecordMapper,
    private readonly taskValueMapper: TaskValueMapper,
  ) {}

  async list(
    filter: InstanceFilter,
    after: InstancePosition | null,
    limit: number,
  ): Promise<InstancePage> {
    const position = this.#after(after);
    const namespace =
      filter.namespace === null
        ? undefined
        : eq(workflows.namespace, filter.namespace);
    const name =
      filter.name === null ? undefined : eq(workflows.name, filter.name);
    const version =
      filter.version === null ? undefined : eq(versions.semver, filter.version);
    const phase =
      filter.phase === null ? undefined : eq(instances.phase, filter.phase);
    const startedFrom =
      filter.startedFrom === null
        ? undefined
        : gte(instances.startedAt, filter.startedFrom);
    const startedTo =
      filter.startedTo === null
        ? undefined
        : lte(instances.startedAt, filter.startedTo);
    const conditions = and(
      position,
      namespace,
      name,
      version,
      phase,
      startedFrom,
      startedTo,
    );
    const fetched = limit + 1;
    const rows = await this.txHost.tx
      .select({
        id: instances.id,
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        phase: instances.phase,
        trigger: instances.trigger,
        createdAt: instances.createdAt,
        startedAt: instances.startedAt,
        endedAt: instances.endedAt,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .where(conditions)
      .orderBy(desc(instances.createdAt), desc(instances.id))
      .limit(fetched);
    return this.#pageOf(rows, limit, (last) => ({
      createdAt: last.createdAt,
      id: last.id,
    }));
  }

  async get(id: string): Promise<InstanceDetail | null> {
    const [row] = await this.txHost.tx
      .select({
        id: instances.id,
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        phase: instances.phase,
        trigger: instances.trigger,
        createdAt: instances.createdAt,
        startedAt: instances.startedAt,
        endedAt: instances.endedAt,
        input: instances.input,
        output: instances.output,
        error: instances.error,
        originId: instances.originId,
        starterId: instances.starterId,
        starterName: users.name,
        cancelReason: instances.cancelReason,
        runWaits: instances.runWaits,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .leftJoin(users, eq(users.id, instances.starterId))
      .where(eq(instances.id, id));

    if (!row) return null;

    const waits = await this.#waitsOf(row.id, row.runWaits);
    const controls = WorkflowInstance.controlsIn(row.phase);
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      version: row.version,
      phase: row.phase,
      trigger: row.trigger,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      input: row.input ?? null,
      output: row.output,
      error: row.error,
      originId: row.originId,
      startedBy: this.#starterOf(row.starterId, row.starterName),
      controls,
      cancelReason: row.cancelReason,
      waits,
    };
  }

  async tasks(
    id: string,
    after: number | null,
    limit: number,
  ): Promise<TaskPage | null> {
    const [found] = await this.txHost.tx
      .select({ id: instances.id, runWaits: instances.runWaits })
      .from(instances)
      .where(eq(instances.id, id));

    if (!found) return null;

    const retries = this.#retriesOf(found.runWaits);
    const fetched = limit + 1;
    const positions = await this.#taskPositionsOf(id, after, fetched);
    const page = this.#pageOf(positions, limit, (last) => last.opened);
    const executions = page.items.map((position) => position.execution);
    const events = await this.#taskEventsOf(id, executions);
    const finish = await this.#finishOf(id);
    const rows = await this.#taskValuesOf(id, executions);
    const values = this.taskValueMapper.valuesOf(rows);
    const items = this.taskRecordMapper.recordsOf(
      page.items,
      events,
      finish,
      retries,
      values,
    );
    return { items, next: page.next };
  }

  async taskOutput(id: string, execution: string): Promise<TaskOutput | null> {
    const [row] = await this.txHost.tx
      .select({ sealedValue: taskValues.sealedValue })
      .from(taskValues)
      .where(
        and(
          eq(taskValues.instanceId, id),
          eq(taskValues.execution, execution),
          eq(taskValues.kind, TaskValueKind.Output),
        ),
      );

    if (!row) return null;

    const value = this.taskValueMapper.valueOf(row.sealedValue);
    return { value };
  }

  #taskValuesOf(
    id: string,
    executions: readonly string[],
  ): Promise<TaskValueRow[]> {
    if (executions.length === 0) return Promise.resolve([]);

    return this.txHost.tx
      .select({
        execution: taskValues.execution,
        kind: taskValues.kind,
        sealedValue: taskValues.sealedValue,
      })
      .from(taskValues)
      .where(
        and(
          eq(taskValues.instanceId, id),
          inArray(taskValues.execution, executions),
        ),
      );
  }

  #retriesOf(waits: readonly RunWait[]): ReadonlyMap<string, Date> {
    const retrying = waits.flatMap((wait) =>
      wait.retryOf === null || wait.until === null
        ? []
        : [[wait.retryOf, new Date(wait.until)] as const],
    );
    return new Map(retrying);
  }

  async countsByPhase(from: Date, to: Date): Promise<readonly PhaseCount[]> {
    const count = sql<number>`count(*)::int`;
    return this.txHost.tx
      .select({ phase: instances.phase, count })
      .from(instances)
      .where(and(gte(instances.createdAt, from), lt(instances.createdAt, to)))
      .groupBy(instances.phase);
  }

  #taskPositionsOf(
    id: string,
    after: number | null,
    fetched: number,
  ): Promise<TaskPosition[]> {
    const execution = sql<string>`${events.execution}`;
    const opened = sql<number>`min(${events.sequence})`.mapWith(Number);
    const later = after === null ? undefined : gt(opened, after);
    return this.txHost.tx
      .select({ execution, opened })
      .from(events)
      .where(
        and(
          eq(events.instanceId, id),
          inArray(events.lifecycle, PostgresInstanceQueries.OPENINGS),
          isNotNull(events.execution),
        ),
      )
      .groupBy(events.execution)
      .having(later)
      .orderBy(asc(opened))
      .limit(fetched);
  }

  async #taskEventsOf(
    id: string,
    executions: readonly string[],
  ): Promise<TaskEventRow[]> {
    if (executions.length === 0) return [];

    const execution = sql<string>`${events.execution}`;
    const name = this.#nameOf();
    const data = this.#dataOf();
    return this.txHost.tx
      .select({ execution, name, data, acceptedAt: events.acceptedAt })
      .from(events)
      .where(
        and(
          eq(events.instanceId, id),
          inArray(events.execution, executions),
          inArray(events.lifecycle, PostgresInstanceQueries.TASK_EVENTS),
        ),
      )
      .orderBy(asc(events.sequence));
  }

  async #finishOf(id: string): Promise<LifecycleEventRow | null> {
    const name = this.#nameOf();
    const data = this.#dataOf();
    const [finish] = await this.txHost.tx
      .select({ name, data, acceptedAt: events.acceptedAt })
      .from(events)
      .where(
        and(
          eq(events.instanceId, id),
          inArray(events.lifecycle, PostgresInstanceQueries.FINISHES),
        ),
      )
      .orderBy(asc(events.sequence))
      .limit(1);
    return finish ?? null;
  }

  #dataOf(): SQL<JsonObject> {
    return sql<JsonObject>`${events.cloudEvent} -> 'data'`;
  }

  #nameOf(): SQL<LifecycleEventName> {
    return sql<LifecycleEventName>`${events.lifecycle}`;
  }

  async #waitsOf(
    id: string,
    waits: readonly RunWait[],
  ): Promise<InstanceWait[]> {
    const awaited = waits
      .filter((wait) => wait.kind === WaitKind.Child)
      .map((wait) => wait.effectId);
    const children = await this.#childrenOf(id, awaited);
    return waits.map((wait) => ({
      kind: wait.kind,
      until: wait.until === null ? null : new Date(wait.until),
      stream: wait.stream,
      instanceId: children.get(wait.effectId) ?? null,
    }));
  }

  async #childrenOf(
    id: string,
    effectIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (effectIds.length === 0) return new Map();

    const rows = await this.txHost.tx
      .select({ id: instances.id, effectId: instances.originEffectId })
      .from(instances)
      .where(
        and(
          eq(instances.originId, id),
          inArray(instances.originEffectId, effectIds),
        ),
      );
    const entries = rows.map((row) => [row.effectId ?? "", row.id] as const);
    return new Map(entries);
  }

  #starterOf(id: string | null, name: string | null): Person | null {
    if (id === null || name === null) return null;

    return { id, name };
  }

  #after(position: InstancePosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${instances.createdAt}, ${instances.id}) < (${position.createdAt}, ${position.id})`;
  }

  #pageOf<R, P>(
    rows: readonly R[],
    limit: number,
    positionOf: (last: R) => P,
  ): { readonly items: readonly R[]; readonly next: P | null } {
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const more = rows.length > limit;

    if (!more || last === undefined) return { items, next: null };

    const next = positionOf(last);
    return { items, next };
  }
}
