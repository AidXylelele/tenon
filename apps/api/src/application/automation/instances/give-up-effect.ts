import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { EffectReference } from "./interfaces.js";
import { InstanceRuns, WorkflowInstanceRepository } from "./ports.js";

@Injectable()
export class GiveUpEffect {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EffectReference): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const awaited = instance.awaits(command.effectId);

    if (!awaited) return;

    await this.unitOfWork.run(() => this.runs.fail(instance));
  }
}
