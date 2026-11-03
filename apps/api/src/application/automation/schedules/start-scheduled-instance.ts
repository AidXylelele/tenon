import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { TriggerKind } from '../../../domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
import type { Result } from '../../../domain/result.js';
import { Missing } from '../enums.js';
import {
  InstanceRuns,
  WorkflowInstanceRepository,
} from '../instances/ports.js';
import { Clock } from '../ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import type { StartScheduledCommand } from './ports.js';

export type ScheduledResult = Result<
  WorkflowInstance | null,
  WorkflowRefusal | Missing
>;

// An occurrence of a cron, an interval or an `after` delay starts one instance of the current
// version, once: a repeated occurrence finds its instance (FR-029).
@Injectable()
export class StartScheduledInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: StartScheduledCommand): Promise<ScheduledResult> {
    const now = this.clock.now();
    const existing = await this.instances.find(command.instanceId);

    if (existing !== null) return { ok: true, value: existing };

    const workflow = await this.workflows.findById(command.workflowId);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const scheduledId = workflow.scheduledVersionId;

    if (scheduledId === null)
      return { ok: false, failure: WorkflowRefusal.Off };

    const version = await this.versions.findById(scheduledId);

    if (version === null) return { ok: false, failure: Missing.Version };

    const chainRunning = await this.instances.hasUnendedScheduled(workflow.id);
    const started = workflow.startScheduledInstance({
      instanceId: command.instanceId,
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: command.chained,
      chainRunning,
      now,
    });

    if (!started.ok || started.value === null) return started;

    await this.instances.save(started.value);
    await this.runs.start(started.value);
    return started;
  }
}
