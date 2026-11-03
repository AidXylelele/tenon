import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, type SQL, sql } from 'drizzle-orm';
import type {
  VersionSummary,
  WorkflowPage,
  WorkflowPageRequest,
  WorkflowPosition,
  WorkflowQueries,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { WorkflowStatus } from '../../../domain/automation/workflows/enums.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { DrizzleTx } from '../interfaces.js';
import { KeysetPage } from '../keyset-page.js';
import {
  workflow as workflows,
  workflowVersion as versions,
} from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowQueries implements WorkflowQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async list(page: WorkflowPageRequest): Promise<WorkflowPage> {
    const after = this.#after(page.after);
    const status = this.#status(page.status);
    const fetched = page.limit + 1;
    const rows = await this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        status: workflows.status,
        on: workflows.on,
        currentVersion: versions.semver,
      })
      .from(workflows)
      .leftJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(and(after, status))
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
        status: workflows.status,
        on: workflows.on,
        currentVersion: versions.semver,
      })
      .from(workflows)
      .leftJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(this.#named(name));
    return row ?? null;
  }

  // A workflow's versions, or null when there is no such workflow.
  async versions(name: WorkflowName): Promise<VersionSummary[] | null> {
    const [found] = await this.txHost.tx
      .select({ id: workflows.id })
      .from(workflows)
      .where(this.#named(name));

    if (!found) return null;

    return this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
        dsl: versions.dsl,
        current: sql<boolean>`${versions.id} = ${workflows.currentVersionId}`,
        publishedBy: versions.publisherId,
        publishedAt: versions.publishedAt,
      })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(eq(workflows.id, found.id))
      .orderBy(asc(versions.publishedAt));
  }

  async document(
    name: WorkflowName,
    version: string,
  ): Promise<JsonObject | null> {
    const named = this.#named(name);
    const [row] = await this.txHost.tx
      .select({ document: versions.document })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(and(named, eq(versions.semver, version)));
    return row?.document ?? null;
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

  // A row comparison, which the unique (namespace, name) index answers.
  #after(position: WorkflowPosition | null): SQL | undefined {
    if (position === null) return undefined;

    return sql`(${workflows.namespace}, ${workflows.name}) > (${position.namespace}, ${position.name})`;
  }
}
