import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, type SQL, sql } from 'drizzle-orm';
import type {
  VersionDocument,
  VersionDocuments,
  VersionSummary,
  WorkflowPage,
  WorkflowPageRequest,
  WorkflowPosition,
  WorkflowQueries,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { DrizzleTx } from '../interfaces.js';
import { KeysetPage } from '../keyset-page.js';
import {
  workflow as workflows,
  workflowVersion as versions,
} from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowQueries
  implements WorkflowQueries, VersionDocuments
{
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(page: WorkflowPageRequest): Promise<WorkflowPage> {
    const after = this.#after(page.after);
    const fetched = page.limit + 1;
    const rows = await this.txHost.tx
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
    return KeysetPage.of(rows, page.limit, (last) => ({
      namespace: last.namespace,
      name: last.name,
    }));
  }

  async get(name: WorkflowName): Promise<WorkflowSummary | null> {
    const [row] = await this.txHost.tx
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
    return this.txHost.tx
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
    const [row] = await this.txHost.tx
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
    const [row] = await this.txHost.tx
      .select({ format: versions.sourceFormat, text: versions.sourceText })
      .from(versions)
      .where(eq(versions.id, versionId));
    return row ?? null;
  }

  // A row comparison, which the unique (namespace, name) index answers, as for instances.
  #after(position: WorkflowPosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${workflows.namespace}, ${workflows.name}) > (${position.namespace}, ${position.name})`;
  }
}
