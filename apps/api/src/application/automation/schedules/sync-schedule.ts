import { Injectable } from "@nestjs/common";
import { WorkflowRepository } from "../workflows/ports.js";
import type { SyncScheduleCommand } from "./interfaces.js";
import { WorkflowSchedules } from "./ports.js";

@Injectable()
export class SyncSchedule {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly schedules: WorkflowSchedules,
  ) {}

  async execute(command: SyncScheduleCommand): Promise<void> {
    const workflow = await this.workflows.findById(command.workflowId);

    if (workflow === null) return;

    const version = workflow.scheduledVersion;

    if (version === null) {
      await this.schedules.clear(workflow);
      return;
    }

    await this.schedules.apply(workflow, version);
  }
}
