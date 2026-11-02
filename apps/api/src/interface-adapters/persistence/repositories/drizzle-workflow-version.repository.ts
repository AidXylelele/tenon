import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq, type SQL } from 'drizzle-orm';
import type { WorkflowVersionRepository } from '../../../application/automation/workflows/ports.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { VersionReference } from '../../../domain/automation/workflows/version-reference.js';
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

  async findBy(reference: VersionReference): Promise<WorkflowVersion | null> {
    const versionId = reference.versionId;

    if (versionId !== null) return this.#first(eq(versions.id, versionId));

    const workflowId = reference.workflowId;
    const semver = reference.semver;

    if (workflowId === null || semver === null) return null;

    const pinned = and(
      eq(versions.workflowId, workflowId),
      eq(versions.semver, semver),
    );
    return this.#first(pinned);
  }

  @Transactional(Propagation.Mandatory)
  async add(version: WorkflowVersion): Promise<void> {
    const row = WorkflowVersionMapper.toRow(version);

    const insert = this.txHost.tx.insert(versions).values(row);
    await UniqueViolation.translated(insert, () => new StaleWriteError());
  }

  async #first(condition: SQL | undefined): Promise<WorkflowVersion | null> {
    const [found] = await this.txHost.tx
      .select()
      .from(versions)
      .where(condition);

    if (!found) return null;

    return WorkflowVersionMapper.toEntity(found);
  }
}
