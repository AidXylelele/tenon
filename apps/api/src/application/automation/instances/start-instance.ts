import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { TriggerKind } from '../../../domain/automation/instances/enums.js';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import {
  InstanceRuns,
  type StartInstanceCommand,
  type StartResult,
  WorkflowInstanceRepository,
} from './ports.js';

// A start by a user (FR-008): of the version named, or of the workflow's current version.
@Injectable()
export class StartInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: StartInstanceCommand): Promise<StartResult> {
    const now = this.clock.now();
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = await this.versions.findToRun(
      command.name,
      command.version,
    );

    if (version === null) return { ok: false, failure: Missing.Version };

    const started = workflow.startInstance({
      version,
      input: command.input,
      trigger: TriggerKind.Manual,
      starterId: command.starterId,
      originId: null,
      now,
    });

    if (!started.ok) return started;

    await this.instances.save(started.value);
    await this.runs.start(started.value);
    return started;
  }
}
