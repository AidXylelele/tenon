import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { EffectReference } from "./interfaces.js";
import {
  InstanceRuns,
  ReceivedMessages,
  WorkflowInstanceRepository,
} from "./ports.js";

@Injectable()
export class ReceiveForEffect {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly messages: ReceivedMessages,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EffectReference): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const awaited = instance.awaits(command.effectId);

    if (!awaited) return;

    const receipts = await this.messages.awaitedBy(instance);

    if (receipts.length === 0) return;

    await this.unitOfWork.run(() => this.runs.receive(instance));
  }
}
