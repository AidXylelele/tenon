import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, desc, eq, gt, type SQL, sql } from 'drizzle-orm';
import type {
  InstanceDetail,
  InstanceFilter,
  InstancePage,
  InstancePosition,
  InstanceQueries,
  RunPlanView,
  TaskPage,
} from '../../../application/automation/instances/queries.js';
import type { DrizzleTx } from '../interfaces.js';
import { KeysetPage } from '../keyset-page.js';
import {
  taskProgress as progress,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from '../schema/index.js';

@Injectable()
export class DrizzleInstanceQueries implements InstanceQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(
    filter: InstanceFilter,
    after: InstancePosition | null,
    limit: number,
  ): Promise<InstancePage> {
    const conditions = and(
      this.#after(after),
      filter.namespace === null
        ? undefined
        : eq(workflows.namespace, filter.namespace),
      filter.name === null ? undefined : eq(workflows.name, filter.name),
      filter.phase === null ? undefined : eq(instances.phase, filter.phase),
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
    return KeysetPage.of(rows, limit, (last) => ({
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
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .where(eq(instances.id, id));

    if (!row) return null;

    return { ...row, input: row.input ?? null };
  }

  // An instance's task executions in the order they began, or null when it does not exist.
  async tasks(
    id: string,
    after: number | null,
    limit: number,
  ): Promise<TaskPage | null> {
    const [found] = await this.txHost.tx
      .select({ id: instances.id })
      .from(instances)
      .where(eq(instances.id, id));

    if (!found) return null;

    const later = after === null ? undefined : gt(progress.sequence, after);
    const fetched = limit + 1;
    const rows = await this.txHost.tx
      .select({
        sequence: progress.sequence,
        execution: progress.execution,
        reference: progress.reference,
        name: progress.name,
        status: progress.status,
        input: progress.input,
        output: progress.output,
        error: progress.error,
        startedAt: progress.startedAt,
        endedAt: progress.endedAt,
      })
      .from(progress)
      .where(and(eq(progress.instanceId, id), later))
      .orderBy(asc(progress.sequence))
      .limit(fetched);
    const page = KeysetPage.of(rows, limit, (last) => last.sequence);
    const items = page.items.map((row) => ({
      execution: row.execution,
      reference: row.reference,
      name: row.name,
      status: row.status,
      input: row.input ?? null,
      output: row.output ?? null,
      error: row.error,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    }));
    return { items, next: page.next };
  }

  async plan(id: string): Promise<RunPlanView | null> {
    const [row] = await this.txHost.tx
      .select({
        instanceId: instances.id,
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        document: versions.document,
        input: instances.input,
        startedAt: instances.startedAt,
        createdAt: instances.createdAt,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .where(eq(instances.id, id));

    if (!row) return null;

    return {
      instanceId: row.instanceId,
      namespace: row.namespace,
      name: row.name,
      version: row.version,
      document: row.document,
      input: row.input ?? null,
      startedAt: row.startedAt ?? row.createdAt,
    };
  }

  // Newest first: a row comparison on (created_at, id), which the index answers.
  #after(position: InstancePosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${instances.createdAt}, ${instances.id}) < (${position.createdAt}, ${position.id})`;
  }
}
