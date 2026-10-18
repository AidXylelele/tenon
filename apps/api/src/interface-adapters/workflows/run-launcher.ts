import { Injectable } from '@nestjs/common';
import { WorkflowClient } from '@nestjs/workflows';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Run } from '../../domain/run.js';
import type { DrizzleTx } from '../interfaces.js';
import { RunWorkflow } from './run.workflow.js';

@Injectable()
export class RunLauncher {
  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {}

  async launch(run: Run): Promise<void> {
    await this.client.start(
      RunWorkflow,
      { runId: run.id, workflowId: run.workflowId },
      { id: run.id, timeout: run.timeoutMs, transaction: this.txHost.tx },
    );
  }

  async cancel(run: Run): Promise<void> {
    await this.client.cancel(run.id, 'The run was cancelled');
  }
}
