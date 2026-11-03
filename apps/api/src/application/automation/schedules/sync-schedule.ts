import { Injectable } from '@nestjs/common';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import { type SyncScheduleCommand, WorkflowSchedules } from './ports.js';

// After the commit of a workflow whose schedule changed: the engine starts the occurrences of
// its current version while it is on, and none once it is off.
@Injectable()
export class SyncSchedule {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly schedules: WorkflowSchedules,
  ) {}

  async execute(command: SyncScheduleCommand): Promise<void> {
    const workflow = await this.workflows.findById(command.workflowId);

    if (workflow === null) return;

    const currentId = workflow.currentVersionId;

    if (!workflow.on || currentId === null) {
      await this.schedules.clear(workflow);
      return;
    }

    const version = await this.versions.findById(currentId);

    if (version === null) return;

    await this.schedules.apply(workflow, version);
  }
}
