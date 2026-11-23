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

  async execute(reference: EffectReference): Promise<void> {
    const instance = await this.instances.find(reference.instanceId);

    if (instance === null) return;

    const awaited = instance.awaits(reference.effectId);

    if (!awaited) return;

    await this.unitOfWork.run(() => this.runs.fail(instance));
  }
}
