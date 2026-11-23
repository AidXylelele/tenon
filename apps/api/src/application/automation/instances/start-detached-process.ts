import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { EffectResult } from "./enums.js";
import type { EffectReference } from "./interfaces.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class StartDetachedProcess {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(reference: EffectReference): Promise<void> {
    const instance = await this.instances.find(reference.instanceId);
    const request = instance?.requestOf(reference.effectId) ?? null;

    if (instance === null || request === null) return;

    const outcome = this.runtime.outcomeOf(EffectResult.Started);
    const answer = { effectId: reference.effectId, outcome };
    await this.unitOfWork.run(async () => {
      await this.runs.respond(instance, answer);
      await this.runs.detach(instance, reference.effectId, request);
    });
  }
}
