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
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import type {
  CountWindow,
  FailingWorkflows,
  FailureWindow,
  InstanceCounts,
  InstanceDetail,
  InstanceFilter,
  InstancePage,
  InstancePageRequest,
  InstanceTotal,
  InstanceWait,
  ListedInstance,
  PhaseCount,
  TaskOutput,
  TaskPage,
  WindowCount,
} from "../../../application/automation/instances/interfaces.js";
import { InstanceOrder } from "../../../application/automation/instances/enums.js";
import { InstanceQueries } from "../../../application/automation/instances/queries.js";
import type { Person } from "../../../application/identity/users/interfaces.js";
import {
  Phase,
  TaskValueKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { RunWait } from "../../../domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type {
  CountRow,
  FailingRow,
  LifecycleEventName,
  ListedInstanceRow,
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

  async list(request: InstancePageRequest): Promise<InstancePage> {
    const now = new Date();
    const filtered = this.#filtered(request.filter);
    const [rows, counted] = await Promise.all([
      this.#listedRowsOf(request, filtered, now),
      this.#totalOf(filtered),
    ]);
    const items = rows.map((row) => this.#listedOf(row));
    return { items, total: counted.total, exact: counted.exact };
  }

  #listedRowsOf(
    request: InstancePageRequest,
    filtered: SQL | undefined,
    now: Date,
  ): Promise<ListedInstanceRow[]> {
    const duration = sql`coalesce(${instances.endedAt}, ${now}) - ${instances.startedAt}`;
    const durationMs = sql<
      number | null
    >`floor(extract(epoch from ${duration}) * 1000)`;
    const byStart = [
      desc(instances.startedAt),
      desc(instances.createdAt),
      desc(instances.id),
    ];
    const byDuration = [sql`${duration} desc nulls last`, desc(instances.id)];
    const order =
      request.order === InstanceOrder.Duration ? byDuration : byStart;
    const skipped = (request.page - 1) * request.limit;
    return this.txHost.tx
      .select({
        id: instances.id,
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        phase: instances.phase,
        trigger: instances.trigger,
        test: instances.test,
        createdAt: instances.createdAt,
        startedAt: instances.startedAt,
        endedAt: instances.endedAt,
        starterId: instances.starterId,
        starterName: users.name,
        durationMs: durationMs.mapWith(Number),
        runWaits: instances.runWaits,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .leftJoin(users, eq(users.id, instances.starterId))
      .where(filtered)
      .orderBy(...order)
      .limit(request.limit)
      .offset(skipped);
  }

  async #totalOf(filtered: SQL | undefined): Promise<InstanceTotal> {
    const most = InstanceQueries.MOST_COUNTED;
    const beyond = most + 1;
    const matching = this.txHost.tx
      .select({ id: instances.id })
      .from(instances)
      .where(filtered)
      .limit(beyond)
      .as("matching");
    const count = sql<number>`count(*)::int`;
    const [row] = await this.txHost.tx.select({ count }).from(matching);
    const counted = row?.count ?? 0;
    const exact = counted <= most;
    const total = Math.min(counted, most);
    return { total, exact };
  }

  #filtered(filter: InstanceFilter): SQL | undefined {
    const workflow = this.#ofWorkflow(filter.namespace, filter.name);
    const version = this.#ofVersion(filter.version);
    const phases =
      filter.phases.length === 0
        ? undefined
        : inArray(instances.phase, filter.phases);
    const from =
      filter.from === null ? undefined : gte(instances.startedAt, filter.from);
    const to =
      filter.to === null ? undefined : lt(instances.startedAt, filter.to);
    const tests = this.#tests(filter.tests);
    return and(workflow, version, phases, from, to, tests);
  }

  #ofVersion(semver: string | null): SQL | undefined {
    if (semver === null) return undefined;

    const ids = this.txHost.tx
      .select({ id: versions.id })
      .from(versions)
      .where(eq(versions.semver, semver));
    return inArray(instances.versionId, ids);
  }

  #listedOf(row: ListedInstanceRow): ListedInstance {
    const waits = row.runWaits.map((wait) => ({
      kind: wait.kind,
      until: wait.until === null ? null : new Date(wait.until),
      stream: wait.stream,
    }));
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      version: row.version,
      phase: row.phase,
      trigger: row.trigger,
      test: row.test,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      startedBy: this.#starterOf(row.starterId, row.starterName),
      durationMs: row.durationMs,
      waits,
    };
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
        test: instances.test,
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
      test: row.test,
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

  async counts(window: CountWindow): Promise<InstanceCounts> {
    const [rows, live] = await Promise.all([
      this.#bucketed(window),
      this.#live(window),
    ]);
    const buckets = window.buckets.map((start, index) => {
      const position = index + 1;
      const counts = this.#countsIn(rows, position);
      return { start, counts };
    });
    const total = this.#windowTotalsOf(rows);
    const previous = this.#previousOf(window.previousFrom, rows);
    return { to: window.to, buckets, total, previous, live };
  }

  #previousOf(
    from: Date | null,
    rows: readonly CountRow[],
  ): WindowCount | null {
    if (from === null) return null;

    const counts = this.#countsIn(rows, 0);
    return { from, counts };
  }

  async failing(window: FailureWindow): Promise<FailingWorkflows> {
    const rows = await this.#failingRowsOf(window);
    const items = rows.map((row) => ({
      namespace: row.namespace,
      name: row.name,
      failed: row.failed,
      runs: row.runs,
      firstFailedAt: row.firstFailedAt,
      lastFailedAt: row.lastFailedAt,
      lastError: {
        status: row.status,
        type: row.type,
        title: row.title,
        detail: row.detail,
      },
      stillFailing: row.stillFailing,
    }));
    const [first] = rows;
    return {
      items,
      workflows: first?.workflows ?? 0,
      failed: first?.failedRuns ?? 0,
    };
  }

  #failingRowsOf(window: FailureWindow): Promise<FailingRow[]> {
    const tests = this.#tests(window.tests);
    const inWindow = and(
      gte(instances.startedAt, window.from),
      lt(instances.startedAt, window.to),
      tests,
    );
    const faulted = sql`${instances.phase} = ${Phase.Faulted}`;
    const failed = sql<number>`count(*) filter (where ${faulted})::int`;
    const runs = sql<number>`count(*)::int`;
    const firstFailedAt = sql<Date>`min(${instances.startedAt}) filter (where ${faulted})`;
    const lastFailedAt = sql<Date>`max(${instances.startedAt}) filter (where ${faulted})`;
    const failing = this.txHost.tx
      .select({
        workflowId: instances.workflowId,
        failed: failed.as("failed"),
        runs: runs.as("runs"),
        firstFailedAt: firstFailedAt
          .mapWith(instances.startedAt)
          .as("first_failed_at"),
        lastFailedAt: lastFailedAt
          .mapWith(instances.startedAt)
          .as("last_failed_at"),
      })
      .from(instances)
      .where(inWindow)
      .groupBy(instances.workflowId)
      .having(sql`count(*) filter (where ${faulted}) > 0`)
      .as("failing");
    const ofFailing = sql`${instances.workflowId} = "failing"."workflow_id"`;
    const lastFailure = this.txHost.tx
      .select({ error: instances.error })
      .from(instances)
      .where(
        and(
          ofFailing,
          eq(instances.phase, Phase.Faulted),
          sql`${instances.startedAt} = "failing"."last_failed_at"`,
          tests,
        ),
      )
      .orderBy(desc(instances.id))
      .limit(1)
      .as("last_failure");
    const live = WorkflowInstance.livePhases();
    const latest = this.txHost.tx
      .select({ phase: instances.phase })
      .from(instances)
      .where(and(ofFailing, notInArray(instances.phase, live), inWindow))
      .orderBy(desc(instances.startedAt), desc(instances.id))
      .limit(1)
      .as("latest");
    const error = lastFailure.error;
    const numericStatus = sql`jsonb_typeof(${error} -> 'status') = 'number'`;
    const status = sql<
      number | null
    >`(case when ${numericStatus} then (${error} ->> 'status')::numeric end)::int`;
    const stillFailing = sql<boolean>`coalesce(${latest.phase} = ${Phase.Faulted}, false)`;
    return this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        failed: failing.failed,
        runs: failing.runs,
        firstFailedAt: failing.firstFailedAt,
        lastFailedAt: failing.lastFailedAt,
        status,
        type: sql<string | null>`${error} ->> 'type'`,
        title: sql<string | null>`${error} ->> 'title'`,
        detail: sql<string | null>`${error} ->> 'detail'`,
        stillFailing,
        workflows: sql<number>`(count(*) over ())::int`,
        failedRuns: sql<number>`(sum(${failing.failed}) over ())::int`,
      })
      .from(failing)
      .innerJoin(workflows, eq(workflows.id, failing.workflowId))
      .leftJoinLateral(lastFailure, sql`true`)
      .leftJoinLateral(latest, sql`true`)
      .orderBy(
        desc(failing.failed),
        desc(failing.lastFailedAt),
        asc(workflows.namespace),
        asc(workflows.name),
      )
      .limit(window.limit);
  }

  #bucketed(window: CountWindow): Promise<CountRow[]> {
    const first = window.buckets[0] ?? window.to;
    const from = window.previousFrom ?? first;
    const edges = window.buckets.map((start) => start.toISOString());
    const thresholds = sql`${sql.param(edges)}::timestamptz[]`;
    const bucket = sql<number>`width_bucket(${instances.startedAt}, ${thresholds})`;
    const count = sql<number>`count(*)::int`;
    const workflow = this.#ofWorkflow(window.namespace, window.name);
    const tests = this.#tests(window.tests);
    return this.txHost.tx
      .select({ bucket, phase: instances.phase, count })
      .from(instances)
      .where(
        and(
          gte(instances.startedAt, from),
          lt(instances.startedAt, window.to),
          workflow,
          tests,
        ),
      )
      .groupBy(sql`1`, sql`2`);
  }

  #live(window: CountWindow): Promise<PhaseCount[]> {
    const live = WorkflowInstance.livePhases();
    const workflow = this.#ofWorkflow(window.namespace, window.name);
    const tests = this.#tests(window.tests);
    const count = sql<number>`count(*)::int`;
    return this.txHost.tx
      .select({ phase: instances.phase, count })
      .from(instances)
      .where(and(inArray(instances.phase, live), workflow, tests))
      .groupBy(instances.phase);
  }

  #countsIn(rows: readonly CountRow[], position: number): PhaseCount[] {
    const counted = rows.filter((row) => row.bucket === position);
    return counted.map((row) => ({ phase: row.phase, count: row.count }));
  }

  #windowTotalsOf(rows: readonly CountRow[]): PhaseCount[] {
    const totals = new Map<Phase, number>();

    for (const row of rows) {
      if (row.bucket === 0) continue;

      const sum = (totals.get(row.phase) ?? 0) + row.count;
      totals.set(row.phase, sum);
    }

    return Array.from(totals, ([phase, count]) => ({ phase, count }));
  }

  #ofWorkflow(namespace: string | null, name: string | null): SQL | undefined {
    const anyWorkflow = namespace === null && name === null;

    if (anyWorkflow) return undefined;

    const inNamespace =
      namespace === null ? undefined : eq(workflows.namespace, namespace);
    const named = name === null ? undefined : eq(workflows.name, name);
    const ids = this.txHost.tx
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(inNamespace, named));
    return inArray(instances.workflowId, ids);
  }

  #tests(included: boolean): SQL | undefined {
    if (included) return undefined;

    return eq(instances.test, false);
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
