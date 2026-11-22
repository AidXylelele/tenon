import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import type { InstanceCommand } from "./interfaces.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class CancelStrandedRun {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly runs: InstanceRuns,
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null || instance.ended) return;

    const continued = await this.runtime.continues(instance);

    if (continued) return;

    const now = new Date();
    const ending = await this.runtime.cancelledEnding(instance, now);
    instance.cancelStranded(ending, now);
    await this.instances.save(instance);
    await this.runs.wakeOnCutOver(instance);
  }
}
