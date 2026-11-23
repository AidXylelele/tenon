import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import type {
  ScheduledStarts,
  StartSlot,
} from "../../../application/automation/schedules/interfaces.js";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import type {
  LastRun,
  VersionIdentity,
  VersionProgram,
  VersionSource,
  VersionSummary,
  WorkflowPage,
  WorkflowPageRequest,
  WorkflowPosition,
  WorkflowSummary,
} from "../../../application/automation/workflows/interfaces.js";
import type { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { WorkflowStatus } from "../../../domain/automation/workflows/enums.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type {
  Transaction,
  WorkflowSummaryRow,
  VersionSummaryRow,
} from "../interfaces.js";
import {
  user as users,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresWorkflowQueries implements WorkflowQueries {
  private static readonly LIKE_SPECIALS = /[\\%_]/g;

  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  async list(page: WorkflowPageRequest): Promise<WorkflowPage> {
    const after = this.#after(page.after);
    const status = this.#status(page.status);
    const search = this.#search(page.search);
    const fetched = page.limit + 1;
    const published = this.#published();
    const rows = await this.#summaries()
      .where(and(published, after, status, search))
      .orderBy(asc(workflows.namespace), asc(workflows.name))
      .limit(fetched);
    const summaries = rows.map((row) => this.#summaryOf(row));
    return this.#pageOf(summaries, page.limit, (last) => ({
      namespace: last.namespace,
      name: last.name,
    }));
  }

  async get(name: WorkflowName): Promise<WorkflowSummary | null> {
    const named = this.#named(name);
    const published = this.#published();
    const [row] = await this.#summaries().where(and(named, published));

    if (!row) return null;

    return this.#summaryOf(row);
  }

  async version(
    name: WorkflowName,
    version: string,
  ): Promise<VersionSummary | null> {
    const numbered = this.#numbered(name, version);
    const [row] = await this.#versions().where(numbered);

    if (!row) return null;

    return this.#versionOf(row);
  }

  async versions(name: WorkflowName): Promise<VersionSummary[] | null> {
    const named = this.#named(name);
    const published = this.#published();
    const [found] = await this.txHost.tx
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(named, published));

    if (!found) return null;

    const rows = await this.#versions()
      .where(and(eq(workflows.id, found.id), eq(versions.test, false)))
      .orderBy(asc(versions.publishedAt));
    return rows.map((row) => this.#versionOf(row));
  }

  async document(
    name: WorkflowName,
    version: string,
  ): Promise<JsonObject | null> {
    const numbered = this.#numbered(name, version);
    const [row] = await this.txHost.tx
      .select({ document: versions.document })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(numbered);
    return row?.document ?? null;
  }

  async source(
    name: WorkflowName,
    version: string,
  ): Promise<VersionSource | null> {
    const numbered = this.#numbered(name, version);
    const [row] = await this.txHost.tx
      .select({ source: versions.source })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(numbered);
    return row ?? null;
  }

  async program(
    name: WorkflowName,
    version: string,
  ): Promise<VersionProgram | null> {
    const numbered = this.#numbered(name, version);
    const [row] = await this.#programs()
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(numbered);
    return row ?? null;
  }

  async programById(versionId: string): Promise<VersionProgram | null> {
    const [row] = await this.#programs().where(eq(versions.id, versionId));
    return row ?? null;
  }

  async identityById(versionId: string): Promise<VersionIdentity | null> {
    const [row] = await this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        dsl: versions.dsl,
      })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(eq(versions.id, versionId));
    return row ?? null;
  }

  scheduledStarts(slots: readonly StartSlot[]): Promise<ScheduledStarts[]> {
    const rows = slots.map((slot) => ({
      workflow_id: slot.workflowId,
      first_at: slot.from.toISOString(),
      end_at: slot.to.toISOString(),
    }));
    const json = JSON.stringify(rows);
    const slotted = sql`jsonb_to_recordset(${json}::jsonb) as slot(workflow_id uuid, first_at timestamptz, end_at timestamptz)`;
    const workflowId = sql<string>`slot.workflow_id`;
    const count = sql<number>`count(*)::int`;
    const started = this.txHost.tx
      .select({ starts: count.as("starts") })
      .from(instances)
      .where(
        and(
          eq(instances.workflowId, workflowId),
          eq(instances.trigger, TriggerKind.Schedule),
          gte(instances.createdAt, sql`slot.first_at`),
          lt(instances.createdAt, sql`slot.end_at`),
        ),
      )
      .as("started");
    return this.txHost.tx
      .select({
        workflowId: workflows.id,
        namespace: workflows.namespace,
        name: workflows.name,
        schedule: versions.schedule,
        starts: started.starts,
      })
      .from(slotted)
      .innerJoin(workflows, eq(workflows.id, workflowId))
      .innerJoin(versions, eq(versions.id, workflows.currentVersionId))
      .leftJoinLateral(started, sql`true`)
      .orderBy(asc(workflows.namespace), asc(workflows.name));
  }

  #programs() {
    return this.txHost.tx
      .select({
        versionId: versions.id,
        digest: versions.digest,
        document: versions.document,
        imports: versions.imports,
        secrets: versions.secrets,
      })
      .from(versions)
      .$dynamic();
  }

  #summaries() {
    const lastRun = this.txHost.tx
      .select({
        id: instances.id,
        phase: instances.phase,
        createdAt: instances.createdAt,
      })
      .from(instances)
      .where(
        and(eq(instances.workflowId, workflows.id), eq(instances.test, false)),
      )
      .orderBy(desc(instances.createdAt), desc(instances.id))
      .limit(1)
      .as("last_run");
    const starts = sql<number>`(select count(*)::int from ${instances} where ${instances.workflowId} = ${workflows.id} and not ${instances.test})`;
    const title = sql<
      string | null
    >`${versions.document} -> 'document' ->> 'title'`;
    return this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        title,
        status: workflows.status,
        on: workflows.on,
        currentVersion: versions.semver,
        schedule: versions.schedule,
        starts,
        lastRunId: lastRun.id,
        lastRunPhase: lastRun.phase,
        lastRunAt: lastRun.createdAt,
      })
      .from(workflows)
      .leftJoin(versions, eq(versions.id, workflows.currentVersionId))
      .leftJoinLateral(lastRun, sql`true`)
      .$dynamic();
  }

  #summaryOf(row: WorkflowSummaryRow): WorkflowSummary {
    return {
      namespace: row.namespace,
      name: row.name,
      title: row.title,
      status: row.status,
      on: row.on,
      currentVersion: row.currentVersion,
      schedule: row.schedule,
      starts: row.starts,
      lastRun: this.#lastRunOf(row),
    };
  }

  #lastRunOf(row: WorkflowSummaryRow): LastRun | null {
    if (row.lastRunId === null || row.lastRunPhase === null) return null;

    if (row.lastRunAt === null) return null;

    return {
      id: row.lastRunId,
      phase: row.lastRunPhase,
      createdAt: row.lastRunAt,
    };
  }

  #versions() {
    return this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        dsl: versions.dsl,
        current: sql<boolean>`${versions.id} = ${workflows.currentVersionId}`,
        publisherId: versions.publisherId,
        publisherName: users.name,
        publishedAt: versions.publishedAt,
      })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .innerJoin(users, eq(users.id, versions.publisherId))
      .$dynamic();
  }

  #versionOf(row: VersionSummaryRow): VersionSummary {
    const publishedBy = { id: row.publisherId, name: row.publisherName };
    return {
      namespace: row.namespace,
      name: row.name,
      version: row.version,
      dsl: row.dsl,
      current: row.current,
      publishedBy,
      publishedAt: row.publishedAt,
    };
  }

  #search(search: string | null): SQL | undefined {
    if (search === null) return undefined;

    const escaped = search.replace(
      PostgresWorkflowQueries.LIKE_SPECIALS,
      "\\$&",
    );
    const pattern = `%${escaped}%`;
    return sql`(${workflows.namespace} || '/' || ${workflows.name}) ilike ${pattern}`;
  }

  #numbered(name: WorkflowName, version: string): SQL | undefined {
    const named = this.#named(name);
    return and(named, eq(versions.semver, version), eq(versions.test, false));
  }

  #published(): SQL {
    return isNotNull(workflows.currentVersionId);
  }

  #named(name: WorkflowName): SQL | undefined {
    return and(
      eq(workflows.namespace, name.namespace),
      eq(workflows.name, name.name),
    );
  }

  #status(status: WorkflowStatus | null): SQL | undefined {
    if (status === null) return undefined;

    return eq(workflows.status, status);
  }

  #after(position: WorkflowPosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${workflows.namespace}, ${workflows.name}) > (${position.namespace}, ${position.name})`;
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
