import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { InstanceCommand } from "../instances/interfaces.js";
import { WorkflowInstanceRepository } from "../instances/ports.js";
import { WorkflowEvents, WorkflowRepository } from "../workflows/ports.js";

@Injectable()
export class ContinueSchedule {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly workflows: WorkflowRepository,
    private readonly events: WorkflowEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (!instance?.continuesSchedule) return;

    const workflow = await this.workflows.findById(instance.workflowId);

    if (workflow === null) return;

    const now = new Date();
    const continued = workflow.continueSchedule(instance, now);

    if (!continued) return;

    await this.unitOfWork.run(async () => {
      await this.workflows.save(workflow);
      await this.events.dispatch(workflow);
    });
  }
}
