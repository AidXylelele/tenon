import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq, sql } from 'drizzle-orm';
import type { WorkflowRepository } from '../../../application/automation/workflows/ports.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import { StaleWriteError } from '../../../domain/errors.js';
import type { DrizzleTx } from '../interfaces.js';
import { WorkflowMapper } from '../mappers/workflow.mapper.js';
import { workflow as workflows } from '../schema/index.js';
import { UniqueViolation } from '../unique-violation.js';

@Injectable()
export class DrizzleWorkflowRepository implements WorkflowRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async findByName(name: WorkflowName): Promise<Workflow | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
        ),
      );

    if (!row) return null;

    return WorkflowMapper.toEntity(row);
  }

  async findById(id: string): Promise<Workflow | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));

    if (!row) return null;

    return WorkflowMapper.toEntity(row);
  }

  @Transactional(Propagation.Mandatory)
  async save(workflow: Workflow): Promise<void> {
    const row = WorkflowMapper.toRow(workflow);
    const nextVersion = workflow.version + 1;
    const upsert = this.txHost.tx
      .insert(workflows)
      .values({ ...row, version: nextVersion })
      .onConflictDoUpdate({
        target: workflows.id,
        set: {
          status: sql`excluded.status`,
          currentVersionId: sql`excluded.current_version_id`,
          archivedAt: sql`excluded.archived_at`,
          version: sql`excluded.version`,
        },
        setWhere: eq(workflows.version, workflow.version),
      })
      .returning({ id: workflows.id });

    // A workflow registered under the same name by a concurrent publish is a stale write.
    const saved = await UniqueViolation.translated(
      upsert,
      () => new StaleWriteError(),
    );

    if (saved.length === 0) throw new StaleWriteError();
  }
}
