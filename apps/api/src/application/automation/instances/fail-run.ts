import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { InstanceCommand } from "./interfaces.js";
import { InstanceEvents } from "./instance-events.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class FailRun {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null || instance.ended) return;

    const now = new Date();
    const ending = await this.runtime.faultedEnding(instance, now);
    instance.fail(ending, now);
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
  }
}
