import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Clock } from '../ports.js';
import { WorkflowSchedules } from '../schedules/ports.js';
import { WorkflowVersionRepository } from '../workflows/ports.js';
import {
  type EndInstanceCommand,
  TaskProgress,
  WorkflowInstanceRepository,
} from './ports.js';

// The run completed: the instance keeps its output, unless it ended before; an instance its
// schedule started continues an `after` chain.
@Injectable()
export class CompleteInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly progress: TaskProgress,
    private readonly versions: WorkflowVersionRepository,
    private readonly schedules: WorkflowSchedules,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: EndInstanceCommand): Promise<void> {
    const now = this.clock.now();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    instance.complete(command.output, now);
    await this.instances.save(instance);
    await this.progress.cancelRunning(instance.id, now);

    if (!instance.continuesSchedule) return;

    const version = await this.versions.findById(instance.versionId);

    if (version !== null) await this.schedules.continueAfter(instance, version);
  }
}
