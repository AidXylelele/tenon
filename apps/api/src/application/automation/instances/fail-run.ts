import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import type { InstanceCommand } from "./interfaces.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class FailRun {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null || instance.ended) return;

    const now = new Date();
    const ending = await this.runtime.faultedEnding(instance, now);
    instance.fail(ending, now);
    await this.instances.save(instance);
  }
}
