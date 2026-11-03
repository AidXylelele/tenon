import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { StartRefusal } from '../../../domain/automation/workflows/interfaces.js';
import type { Result } from '../../../domain/result.js';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import {
  InstanceRuns,
  type RestartInstanceCommand,
  WorkflowInstanceRepository,
} from './ports.js';

// A new instance of an ended one, on its version and with its input.
@Injectable()
export class RestartInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(
    command: RestartInstanceCommand,
  ): Promise<Result<WorkflowInstance, StartRefusal | Missing>> {
    const now = this.clock.now();
    const previous = await this.instances.find(command.instanceId);

    if (previous === null) return { ok: false, failure: Missing.Instance };

    const workflow = await this.workflows.findById(previous.workflowId);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = await this.versions.findById(previous.versionId);

    if (version === null) return { ok: false, failure: Missing.Version };

    const restarted = workflow.restartInstance({
      previous,
      version,
      starterId: command.starterId,
      now,
    });

    if (!restarted.ok) return restarted;

    await this.instances.save(restarted.value);
    await this.runs.start(restarted.value);
    return restarted;
  }
}
