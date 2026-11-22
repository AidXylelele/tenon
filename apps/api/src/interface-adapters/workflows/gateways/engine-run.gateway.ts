import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { WorkflowClient, WorkflowNotFoundError } from "@nestjs/workflows";
import type { InstanceRuns } from "../../../application/automation/instances/ports.js";
import type { Control } from "../../../domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../../persistence/interfaces.js";

@Injectable()
export class EngineRunGateway implements InstanceRuns {
  static readonly RUN = "open-workflow";
  static readonly VERSION = 1;
  static readonly WAKE = "wake";

  constructor(
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<Transaction>,
  ) {}

  @Transactional(Propagation.Mandatory)
  async start(instance: WorkflowInstance): Promise<void> {
    const input = { instanceId: instance.id, generation: 1 };
    const id = this.#runIdOf(instance.id, 1);
    await this.client.start(EngineRunGateway.RUN, input, {
      id,
      version: EngineRunGateway.VERSION,
      transaction: this.txHost.tx,
    });
  }

  @Transactional(Propagation.Mandatory)
  async wakeOnChild(
    parent: WorkflowInstance,
    child: WorkflowInstance,
  ): Promise<void> {
    const cause = `child:${child.id}`;
    await this.#woken(parent, cause);
  }

  @Transactional(Propagation.Mandatory)
  async wakeOnEvent(
    instance: WorkflowInstance,
    sequence: number,
  ): Promise<void> {
    const cause = `event:${String(sequence)}`;
    await this.#woken(instance, cause);
  }

  @Transactional(Propagation.Mandatory)
  async wakeOnControl(
    instance: WorkflowInstance,
    control: Control,
  ): Promise<void> {
    const saved = instance.version + 1;
    const cause = `${control}:${String(saved)}`;
    await this.#woken(instance, cause);
  }

  @Transactional(Propagation.Mandatory)
  async wakeOnInbound(
    instance: WorkflowInstance,
    execution: string,
    position: number,
  ): Promise<void> {
    const cause = `inbound:${execution}:${String(position)}`;
    await this.#woken(instance, cause);
  }

  async #woken(instance: WorkflowInstance, cause: string): Promise<void> {
    const id = `${instance.id}:${cause}`;
    await this.client.signal(EngineRunGateway.WAKE, null, {
      key: instance.id,
      id,
      transaction: this.txHost.tx,
    });
  }

  async continueIn(instanceId: string, generation: number): Promise<void> {
    const input = { instanceId, generation };
    const id = this.#runIdOf(instanceId, generation);
    await this.client.start(EngineRunGateway.RUN, input, {
      id,
      version: EngineRunGateway.VERSION,
    });
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
