import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { WorkflowClient, WorkflowNotFoundError } from "@nestjs/workflows";
import type { InstanceRuns } from "../../application/automation/instances/ports.js";
import type { WorkflowInstance } from "../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../../interface-adapters/persistence/interfaces.js";

@Injectable()
export class EngineRunClient implements InstanceRuns {
  static readonly RUN = "open-workflow";
  static readonly WAKE = "wake";

  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<Transaction>,
  ) {}

  @Transactional(Propagation.Mandatory)
  async start(instance: WorkflowInstance): Promise<void> {
    const input = { instanceId: instance.id, generation: 1 };
    const id = this.#runIdOf(instance.id, 1);
    await this.client.start(EngineRunClient.RUN, input, {
      id,
      transaction: this.txHost.tx,
    });
  }

  @Transactional(Propagation.Mandatory)
  async wake(instance: WorkflowInstance): Promise<void> {
    const saved = instance.version + 1;
    const id = `${instance.id}:${String(saved)}`;
    await this.client.signal(EngineRunClient.WAKE, null, {
      key: instance.id,
      id,
      transaction: this.txHost.tx,
    });
  }

  @Transactional(Propagation.Mandatory)
  async wakeOnInbound(
    instance: WorkflowInstance,
    execution: string,
    position: number,
  ): Promise<void> {
    const id = `${instance.id}:inbound:${execution}:${String(position)}`;
    await this.client.signal(EngineRunClient.WAKE, null, {
      key: instance.id,
      id,
      transaction: this.txHost.tx,
    });
  }

  async continueIn(instanceId: string, generation: number): Promise<void> {
    const input = { instanceId, generation };
    const id = this.#runIdOf(instanceId, generation);
    await this.client.start(EngineRunClient.RUN, input, { id });
  }

  async forget(instanceId: string): Promise<void> {
    for (let generation = 1; ; generation++) {
      const id = this.#runIdOf(instanceId, generation);

      try {
        await this.client.delete(id, { force: true });
      } catch (error) {
        if (error instanceof WorkflowNotFoundError) return;

        throw error;
      }
    }
  }

  #runIdOf(instanceId: string, generation: number): string {
    return `run:${instanceId}:${String(generation)}`;
  }
}
