import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
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

  // In the caller's transaction, so the run starts only with the instance it runs (§9).
  @Transactional(Propagation.Mandatory)
  async start(run: InstanceRun): Promise<void> {
    await this.client.start(InstanceWorkflow, run.input, {
      id: run.id,
      transaction: this.txHost.tx,
    });
  }
}
