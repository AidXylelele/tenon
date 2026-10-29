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
import type { PublishedTargets } from '../../../domain/automation/language/interfaces.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { WorkflowTarget } from '../../../domain/automation/language/workflow-target.js';
import { Database } from '../../interfaces.js';
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

  async referenceFacts(
    targets: readonly WorkflowTarget[],
  ): Promise<PublishedTargets> {
    if (targets.length === 0) return { workflows: [], versions: [] };

    const named = targets.map((target) =>
      and(
        eq(workflows.namespace, target.workflow.namespace),
        eq(workflows.name, target.workflow.name),
      ),
    );
    const versioned = targets.map((target) =>
      and(
        eq(workflows.namespace, target.workflow.namespace),
        eq(workflows.name, target.workflow.name),
        eq(versions.semver, target.version),
      ),
    );
    const existing = await this.db
      .select({ namespace: workflows.namespace, name: workflows.name })
      .from(workflows)
      .where(or(...named));
    const published = await this.db
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
      })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(or(...versioned));
    return { workflows: existing, versions: published };
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
