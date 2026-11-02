import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { WorkflowClient } from '@nestjs/workflows';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import {
  type InstanceRun,
  RunClient,
} from '../../interface-adapters/workflows/runs/interfaces.js';
import { InstanceWorkflow } from './instance.workflow.js';

@Injectable()
export class EngineRunClient implements RunClient {
  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {}

  async start(run: InstanceRun): Promise<void> {
    await this.client.start(InstanceWorkflow, run.input, {
      id: run.id,
      transaction: this.txHost.tx,
    });
  }
}
