import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { WorkflowClient } from '@nestjs/workflows';
import type { DrizzleTx } from '../../interface-adapters/persistence/interfaces.js';
import type { DeliveryRunClient } from '../../interface-adapters/workflows/interfaces.js';
import { DeliveryWorkflow } from './delivery.workflow.js';

// A delivery's run is named by its subscription and event, so a repeated match starts it once
// and every attempt carries the same event.
@Injectable()
export class EngineDeliveryClient implements DeliveryRunClient {
  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {}

  @Transactional(Propagation.Mandatory)
  async start(subscriptionId: string, sequence: number): Promise<void> {
    const id = `delivery-${subscriptionId}-${String(sequence)}`;
    await this.client.start(
      DeliveryWorkflow,
      { subscriptionId, sequence },
      { id, transaction: this.txHost.tx },
    );
  }
}
