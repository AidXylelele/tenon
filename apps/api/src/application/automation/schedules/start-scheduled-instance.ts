import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import {
  InstanceEvents,
  WorkflowInstanceRepository,
} from "../instances/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import type { StartScheduledCommand } from "./interfaces.js";

@Injectable()
export class StartScheduledInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: StartScheduledCommand): Promise<void> {
    const existing = await this.instances.find(command.instanceId);

    if (existing !== null) return;

    const workflow = await this.workflows.findById(command.workflowId);

    if (workflow === null) return;

    const chainRunning = await this.instances.hasUnendedScheduled(workflow.id);
    const now = new Date();
    const started = workflow.startFiredInstance({
      instanceId: command.instanceId,
      chainRunning,
      now,
    });

    if (!started.ok) return;

    const instance = started.value;
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
  }
}
