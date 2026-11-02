import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';
import type {
  EventPage,
  InstanceFilter,
  InstancePage,
  InstancePageRequest,
  InstancePosition,
  InstanceQueries,
  InstanceView,
  PositionPageRequest,
  TaskRecordPage,
} from '../../../application/automation/instances/queries.js';
import { EventOriginKind } from '../../../domain/automation/events/enums.js';
import type { SubWorkflowEnding } from '../../../domain/automation/language/interfaces.js';
import { Phase } from '../../../domain/automation/language/phase.js';
import type { DrizzleTx } from '../interfaces.js';
import { OriginKind } from '../enums.js';
import { WorkflowErrorMapper } from '../mappers/progress/workflow-error.mapper.js';
import {
  event as events,
  taskInstance as tasks,
  workflowInstance as instances,
} from '../schema/index.js';

@Injectable()
export class DrizzleInstanceQueries implements InstanceQueries {
  // Through the transaction host, so a query inside a use case's transaction shares its
  // connection instead of taking a second one from the pool.
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(
    filter: InstanceFilter,
    page: InstancePageRequest,
  ): Promise<InstancePage> {
    const conditions = this.#conditions(filter, page.after);
    const fetched = page.limit + 1;
    const rows = await this.txHost.tx
      .select({
        id: instances.id,
        namespace: instances.namespace,
        name: instances.name,
        version: instances.semver,
        phase: instances.phase,
        startedAt: instances.startedAt,
        endedAt: instances.endedAt,
      })
      .from(instances)
      .where(and(...conditions))
      .orderBy(desc(instances.startedAt), desc(instances.id))
      .limit(fetched);
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);

    if (rows.length <= page.limit || last === undefined)
      return { items, next: null };

    const next = { startedAt: last.startedAt, id: last.id };
    return { items, next };
  }

  async exists(id: string): Promise<boolean> {
    const [row] = await this.txHost.tx
      .select({ id: instances.id })
      .from(instances)
      .where(eq(instances.id, id));
    return row !== undefined;
  }

  async get(id: string): Promise<InstanceView | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(instances)
      .where(eq(instances.id, id));

    if (!row) return null;

    const origin = row.origin;
    const parentId =
      origin.kind === OriginKind.Parent ? origin.instanceId : null;
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      version: row.semver,
      phase: row.phase,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      parentId,
      input: row.input ?? null,
      output: row.output ?? null,
      error: row.error,
    };
  }

  async tasks(id: string, page: PositionPageRequest): Promise<TaskRecordPage> {
    const after = page.after ?? -1;
    const [root] = await this.txHost.tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.instanceId, id), isNull(tasks.parentId)));
    const rootId = root?.id ?? null;
    const rows = await this.txHost.tx
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.instanceId, id),
          isNotNull(tasks.parentId),
          gt(tasks.execution, after),
        ),
      )
      .orderBy(asc(tasks.execution))
      .limit(page.limit + 1);
    const items = rows.slice(0, page.limit).map((row) => ({
      id: row.id,
      reference: row.reference,
      name: row.name,
      parentId: row.parentId === rootId ? null : row.parentId,
      phase: row.phase,
      input: row.rawInput ?? null,
      output: row.output ?? null,
      error: row.error,
      retries: row.retries,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    }));
    const last = rows.at(page.limit - 1);
    const hasMore = rows.length > page.limit;
    const next = hasMore && last ? last.execution : null;
    return { items, next };
  }

  async lifecycleEvents(
    id: string,
    page: PositionPageRequest,
  ): Promise<EventPage> {
    const after = page.after ?? -1;
    const rows = await this.txHost.tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.originInstanceId, id),
          eq(events.originKind, EventOriginKind.Lifecycle),
          gt(events.sequence, after),
        ),
      )
      .orderBy(asc(events.sequence))
      .limit(page.limit + 1);
    const items = rows.slice(0, page.limit).map((row) => ({
      id: row.eventId,
      source: row.source,
      type: row.type,
      time: row.time,
      subject: row.subject,
      dataContentType: row.dataContentType,
      dataSchema: row.dataSchema,
      data: row.data ?? null,
      extensions: row.extensions,
    }));
    const last = rows.at(page.limit - 1);
    const hasMore = rows.length > page.limit;
    const next = hasMore && last ? last.sequence : null;
    return { items, next };
  }

  async subWorkflowEnding(id: string): Promise<SubWorkflowEnding | null> {
    const [row] = await this.txHost.tx
      .select({
        phase: instances.phase,
        output: instances.output,
        error: instances.error,
      })
      .from(instances)
      .where(eq(instances.id, id));

    if (!row) return null;

    const phase = Phase.named(row.phase);
    const error = WorkflowErrorMapper.toDomain(row.error);
    return { phase, output: row.output ?? null, error };
  }

  #conditions(filter: InstanceFilter, after: InstancePosition | null): SQL[] {
    const conditions: SQL[] = [];
    if (filter.namespace !== null)
      conditions.push(eq(instances.namespace, filter.namespace));

    if (filter.name !== null) conditions.push(eq(instances.name, filter.name));

    if (filter.version !== null)
      conditions.push(eq(instances.semver, filter.version));

    if (filter.phase !== null)
      conditions.push(eq(instances.phase, filter.phase));

    if (filter.startedFrom !== null)
      conditions.push(gte(instances.startedAt, filter.startedFrom));

    if (filter.startedTo !== null)
      conditions.push(lte(instances.startedAt, filter.startedTo));

    const following = this.#after(after);

    if (following !== undefined) conditions.push(following);

    return conditions;
  }

  // A row comparison, which an index on (started_at, id) answers; the same condition written
  // with `or` makes PostgreSQL read the history up to the page.
  #after(position: InstancePosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${instances.startedAt}, ${instances.id}) < (${position.startedAt}, ${position.id})`;
  }
}
