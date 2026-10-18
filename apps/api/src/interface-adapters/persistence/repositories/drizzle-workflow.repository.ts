import { Injectable } from '@nestjs/common';
import { Outbox } from '@nestjs/outbox';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { WorkflowRepository } from '../../../application/interfaces.js';
import {
  WorkflowConflictError,
  WorkflowNotFoundError,
} from '../../../domain/errors.js';
import type { Workflow } from '../../../domain/workflow.js';
import type { DrizzleTx } from '../../interfaces.js';
import { WorkflowMapper } from '../mappers/workflow.mapper.js';
import { workflow as workflows } from '../schema/index.js';

@Injectable()
export class DrizzleWorkflowRepository implements WorkflowRepository {
  static readonly ACTIVATION_TOPIC = 'automation.activation';

  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly outbox: Outbox,
  ) {}

  async add(workflow: Workflow): Promise<void> {
    const row = WorkflowMapper.toRow(workflow);
    const inserted = await this.txHost.tx
      .insert(workflows)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: workflows.id });

    if (inserted.length === 0) throw new WorkflowConflictError();

    await this.publish(workflow);
  }

  async update(workflow: Workflow): Promise<void> {
    const row = WorkflowMapper.toRow(workflow);
    const nextVersion = workflow.version + 1;
    const updated = await this.txHost.tx
      .update(workflows)
      .set({ ...row, version: nextVersion })
      .where(
        and(
          eq(workflows.id, workflow.id),
          eq(workflows.version, workflow.version),
        ),
      )
      .returning({ id: workflows.id });

    if (updated.length === 0) throw new WorkflowConflictError();

    await this.publish(workflow);
  }

  async getById(id: string): Promise<Workflow> {
    const [row] = await this.txHost.tx
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));

    if (!row) throw new WorkflowNotFoundError();

    return WorkflowMapper.toEntity(row);
  }

  private async publish(workflow: Workflow): Promise<void> {
    for (const event of workflow.events) {
      await this.outbox.add(this.txHost.tx, {
        topic: DrizzleWorkflowRepository.ACTIVATION_TOPIC,
        key: event.workflowId,
        payload: { workflowId: event.workflowId },
      });
    }

    workflow.clearEvents();
  }
}
