import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
} from 'drizzle-orm';
import type {
  NodeSampleView,
  Page,
  ReleaseSummary,
  ReleaseView,
  WorkflowFilter,
  WorkflowQueries,
  WorkflowSummary,
  WorkflowView,
} from '../../../application/interfaces.js';
import {
  ReleaseNotFoundError,
  WorkflowNotFoundError,
} from '../../../domain/errors.js';
import type { DrizzleTx } from '../../interfaces.js';
import {
  nodeSample as samples,
  release as releases,
  user as users,
  workflow as workflows,
} from '../schema/index.js';
import { PageCursor } from './page-cursor.js';

@Injectable()
export class DrizzleWorkflowQueries implements WorkflowQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(filter: WorkflowFilter): Promise<Page<WorkflowSummary>> {
    const conditions = this.conditions(filter);
    const take = filter.limit + 1;
    const rows = await this.txHost.tx
      .select({
        id: workflows.id,
        name: workflows.name,
        ownerId: workflows.ownerId,
        ownerName: users.name,
        archivedAt: workflows.archivedAt,
        latestRelease: workflows.latestRelease,
        activeRelease: workflows.activeRelease,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .innerJoin(users, eq(users.id, workflows.ownerId))
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt), desc(workflows.id))
      .limit(take);
    const items = rows.slice(0, filter.limit).map((row) => ({
      id: row.id,
      name: row.name,
      owner: { id: row.ownerId, name: row.ownerName },
      archived: row.archivedAt !== null,
      latestRelease: row.latestRelease,
      activeRelease: row.activeRelease,
      updatedAt: row.updatedAt,
    }));
    const last = items.at(-1);
    const nextCursor =
      rows.length > filter.limit && last
        ? PageCursor.encode({ at: last.updatedAt, id: last.id })
        : null;
    return { items, nextCursor };
  }

  async get(id: string): Promise<WorkflowView> {
    const [row] = await this.txHost.tx
      .select({ workflow: workflows, ownerName: users.name })
      .from(workflows)
      .innerJoin(users, eq(users.id, workflows.ownerId))
      .where(eq(workflows.id, id));

    if (!row) throw new WorkflowNotFoundError();

    const sampleRows = await this.txHost.tx
      .select()
      .from(samples)
      .where(eq(samples.workflowId, id));
    const nodeSamples: NodeSampleView[] = sampleRows.map((sample) => ({
      nodeId: sample.nodeId,
      pinned: sample.pinned !== null,
      fields: sample.fields,
    }));
    return {
      id: row.workflow.id,
      name: row.workflow.name,
      owner: { id: row.workflow.ownerId, name: row.ownerName },
      archived: row.workflow.archivedAt !== null,
      latestRelease: row.workflow.latestRelease,
      activeRelease: row.workflow.activeRelease,
      updatedAt: row.workflow.updatedAt,
      revision: row.workflow.revision,
      graph: row.workflow.graph,
      settings: row.workflow.settings,
      samples: nodeSamples,
    };
  }

  async releases(workflowId: string): Promise<ReleaseSummary[]> {
    const rows = await this.txHost.tx
      .select({
        number: releases.number,
        publishedAt: releases.publishedAt,
        publisherId: releases.publishedBy,
        publisherName: users.name,
      })
      .from(releases)
      .innerJoin(users, eq(users.id, releases.publishedBy))
      .where(eq(releases.workflowId, workflowId))
      .orderBy(desc(releases.number));
    return rows.map((row) => ({
      number: row.number,
      publishedAt: row.publishedAt,
      publishedBy: { id: row.publisherId, name: row.publisherName },
    }));
  }

  async release(workflowId: string, number: number): Promise<ReleaseView> {
    const [row] = await this.txHost.tx
      .select({ release: releases, publisherName: users.name })
      .from(releases)
      .innerJoin(users, eq(users.id, releases.publishedBy))
      .where(
        and(eq(releases.workflowId, workflowId), eq(releases.number, number)),
      );

    if (!row) throw new ReleaseNotFoundError();

    return {
      number: row.release.number,
      publishedAt: row.release.publishedAt,
      publishedBy: { id: row.release.publishedBy, name: row.publisherName },
      graph: row.release.graph,
      settings: row.release.settings,
    };
  }

  async activeIds(): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(isNotNull(workflows.activeRelease), isNull(workflows.archivedAt)),
      )
      .orderBy(asc(workflows.id));
    return rows.map((row) => row.id);
  }

  private conditions(filter: WorkflowFilter): SQL[] {
    const conditions: SQL[] = [
      filter.archived
        ? isNotNull(workflows.archivedAt)
        : isNull(workflows.archivedAt),
    ];

    if (filter.search) {
      const escaped = DrizzleWorkflowQueries.escape(filter.search);
      const pattern = `%${escaped}%`;
      conditions.push(ilike(workflows.name, pattern));
    }

    if (filter.ownerId) conditions.push(eq(workflows.ownerId, filter.ownerId));

    const position = PageCursor.decode(filter.cursor);

    if (position) {
      conditions.push(
        or(
          lt(workflows.updatedAt, position.at),
          and(
            eq(workflows.updatedAt, position.at),
            lt(workflows.id, position.id),
          ),
        )!,
      );
    }

    return conditions;
  }

  private static escape(search: string): string {
    return search.replace(/[\\%_]/g, (character) => `\\${character}`);
  }
}
