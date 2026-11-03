import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { WorkflowClient, WorkflowNotFoundError } from '@nestjs/workflows';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import type { RunClient } from '../../interface-adapters/workflows/interfaces.js';
import type { JsonObject } from '../../domain/automation/json.js';
import { EVENT_SIGNAL, RESUME_SIGNAL } from './engine.constants.js';
import { InstanceWorkflow } from './instance.workflow.js';

@Injectable()
export class EngineRunClient implements RunClient {
  private static readonly CANCELLED = 'The instance was cancelled';

  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {}

  // In the caller's transaction, so the run starts only with the instance it runs.
  @Transactional(Propagation.Mandatory)
  async start(instanceId: string): Promise<void> {
    await this.client.start(
      InstanceWorkflow,
      { instanceId },
      {
        id: instanceId,
        transaction: this.txHost.tx,
      },
    );
  }

  async cancel(instanceId: string): Promise<void> {
    await EngineRunClient.unlessGone(() =>
      this.client.cancel(instanceId, EngineRunClient.CANCELLED),
    );
  }

  async resume(instanceId: string): Promise<void> {
    await this.client.signal(RESUME_SIGNAL, null, { key: instanceId });
  }

  async deliver(
    key: string,
    event: JsonObject,
    signalId: string,
  ): Promise<void> {
    await this.client.signal(EVENT_SIGNAL, event, { key, id: signalId });
  }

  async delete(instanceId: string): Promise<void> {
    await EngineRunClient.unlessGone(() =>
      this.client.delete(instanceId, { force: true }),
    );
  }

  private static async unlessGone(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) return;

      throw error;
    }
  }
}
