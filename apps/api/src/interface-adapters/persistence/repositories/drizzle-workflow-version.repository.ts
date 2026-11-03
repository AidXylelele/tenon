import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { WorkflowVersionRepository } from '../../../application/automation/workflows/ports.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import { StaleWriteError } from '../../../domain/errors.js';
import type { DrizzleTx } from '../interfaces.js';
import { WorkflowVersionMapper } from '../mappers/workflow-version.mapper.js';
import {
  workflow as workflows,
  workflowVersion as versions,
} from '../schema/index.js';
import { UniqueViolation } from '../unique-violation.js';

@Injectable()
export class DrizzleWorkflowVersionRepository implements WorkflowVersionRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null> {
    const [found] = await this.txHost.tx
      .select({ version: versions })
      .from(versions)
      .innerJoin(workflows, eq(workflows.id, versions.workflowId))
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
          eq(versions.semver, semver),
        ),
      );

    if (!found) return null;

    return WorkflowVersionMapper.toEntity(found.version);
  }

  async findById(id: string): Promise<WorkflowVersion | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(versions)
      .where(eq(versions.id, id));

    if (!row) return null;

    return WorkflowVersionMapper.toEntity(row);
  }

  async findToRun(
    name: WorkflowName,
    semver: string | null,
  ): Promise<WorkflowVersion | null> {
    if (semver !== null) return this.find(name, semver);

    const [found] = await this.txHost.tx
      .select({ version: versions })
      .from(versions)
      .innerJoin(workflows, eq(workflows.currentVersionId, versions.id))
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
        ),
      );

    if (!found) return null;

    return WorkflowVersionMapper.toEntity(found.version);
  }

  // A version is written once: the same version again finds its row and writes nothing, while
  // a concurrent publish of other content under its identity is a stale write.
  @Transactional(Propagation.Mandatory)
  async add(version: WorkflowVersion): Promise<void> {
    const row = WorkflowVersionMapper.toRow(version);
    const insert = this.txHost.tx
      .insert(versions)
      .values(row)
      .onConflictDoNothing({ target: versions.id });
    await UniqueViolation.translated(insert, () => new StaleWriteError());
  }
}
