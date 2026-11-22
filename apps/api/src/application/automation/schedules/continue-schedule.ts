import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
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
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (!instance?.continuesSchedule) return;

    const workflow = await this.workflows.findById(instance.workflowId);
    const version = workflow?.versionById(instance.versionId) ?? null;

    if (version === null) return;

    await this.schedules.continueAfter(instance, version);
  }
}
