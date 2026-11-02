import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, or, type SQL, sql } from 'drizzle-orm';
import type {
  PageRequest,
  VersionDocument,
  VersionSummary,
  WorkflowPage,
  WorkflowQueries,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import { Database } from '../interfaces.js';
import {
  workflow as workflows,
  workflowVersion as versions,
} from '../schema/index.js';

const SEPARATOR = '\n';

@Injectable()
export class DrizzleWorkflowQueries implements WorkflowQueries {
  constructor(private readonly db: Database) {}

  async list(page: PageRequest): Promise<WorkflowPage> {
    const after = this.#after(page.cursor);
    const fetched = page.limit + 1;
    const rows = await this.db
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        isOn: workflows.isOn,
        currentVersion: versions.semver,
      })
      .from(workflows)
      .leftJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(after)
      .orderBy(asc(workflows.namespace), asc(workflows.name))
      .limit(fetched);
    const items = rows.slice(0, page.limit);
    const last = items.at(-1);
    const hasMore = rows.length > page.limit;
    const next =
      hasMore && last
        ? Buffer.from(`${last.namespace}${SEPARATOR}${last.name}`).toString(
            'base64url',
          )
        : null;
    return { items, next };
  }

  async get(name: WorkflowName): Promise<WorkflowSummary | null> {
    const [row] = await this.db
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        isOn: workflows.isOn,
        currentVersion: versions.semver,
      })
      .from(workflows)
      .leftJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
        ),
      );
    return row ?? null;
  }

  versions(name: WorkflowName): Promise<VersionSummary[]> {
    return this.db
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        dsl: versions.dslVersion,
        current: sql<boolean>`${versions.id} = ${workflows.currentVersionId}`,
        publishedBy: versions.publisherId,
        publishedAt: versions.publishedAt,
      })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
        ),
      )
      .orderBy(asc(versions.publishedAt));
  }

  async document(
    name: WorkflowName,
    version: string,
  ): Promise<VersionDocument | null> {
    const [row] = await this.db
      .select({ format: versions.sourceFormat, text: versions.sourceText })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
          eq(versions.semver, version),
        ),
      );
    return row ?? null;
  }

  async documentOf(versionId: string): Promise<VersionDocument | null> {
    const [row] = await this.db
      .select({ format: versions.sourceFormat, text: versions.sourceText })
      .from(versions)
      .where(eq(versions.id, versionId));
    return row ?? null;
  }

  #after(cursor: string | null): SQL | undefined {
    if (cursor === null) return undefined;

    const decoded = Buffer.from(cursor, 'base64url').toString();
    const [namespace = '', name = ''] = decoded.split(SEPARATOR);
    return or(
      gt(workflows.namespace, namespace),
      and(eq(workflows.namespace, namespace), gt(workflows.name, name)),
    );
  }
}
