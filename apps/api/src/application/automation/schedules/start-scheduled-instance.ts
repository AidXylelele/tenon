import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
} from "../instances/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import type { StartScheduledCommand } from "./interfaces.js";

@Injectable()
export class StartScheduledInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
  ) {}

  @Transactional()
  async execute(command: StartScheduledCommand): Promise<void> {
    const existing = await this.instances.find(command.instanceId);

    if (existing !== null) return;

    const workflow = await this.workflows.findById(command.workflowId);
    const version = workflow?.scheduledVersion ?? null;

    if (workflow === null || version === null) return;

    const chainRunning = await this.instances.hasUnendedScheduled(workflow.id);
    const now = new Date();
    const started = workflow.startScheduledInstance({
      instanceId: command.instanceId,
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: command.chained,
      chainRunning,
      lifecycleOf: null,
      now,
    });

    if (!started.ok) return;

    await this.instances.save(started.value);
    await this.runs.start(started.value);
  }
}
