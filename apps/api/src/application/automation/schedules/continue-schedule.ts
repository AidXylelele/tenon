import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { InstanceCommand } from "../instances/interfaces.js";
import { WorkflowInstanceRepository } from "../instances/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import { WorkflowSchedules } from "./ports.js";

@Injectable()
export class ContinueSchedule {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly workflows: WorkflowRepository,
    private readonly schedules: WorkflowSchedules,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (!instance?.continuesSchedule) return;

    const workflow = await this.workflows.findById(instance.workflowId);
    const version = workflow?.versionById(instance.versionId) ?? null;

    if (version === null) return;

    await this.unitOfWork.run(() =>
      this.schedules.continueAfter(instance, version),
    );
  }
}
