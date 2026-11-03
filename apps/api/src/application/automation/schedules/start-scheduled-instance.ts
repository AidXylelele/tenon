import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { TriggerKind } from '../../../domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
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
// version, once: a repeated occurrence finds its instance (FR-029). A chained occurrence starts
// none while an instance its schedule started runs, so one chain goes on at a time.
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

    const currentId = workflow.currentVersionId;

    if (currentId === null) return { ok: false, failure: Missing.Version };

    const version = await this.versions.findById(currentId);

    if (version === null) return { ok: false, failure: Missing.Version };

    if (command.chained) {
      const running = await this.instances.hasUnendedScheduled(workflow.id);

      if (running) return { ok: true, value: null };
    }

    const started = workflow.startScheduledInstance({
      instanceId: command.instanceId,
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      now,
    });

    if (!started.ok) return started;

    await this.instances.save(started.value);
    await this.runs.start(started.value);
    return started;
  }
}
