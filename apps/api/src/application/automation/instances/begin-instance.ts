import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RunDirective } from '../../../domain/automation/instances/enums.js';
import { Clock } from '../ports.js';
import { type InstanceCommand, WorkflowInstanceRepository } from './ports.js';

// The runtime picked the instance up; one deleted meanwhile is not run.
@Injectable()
export class BeginInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<RunDirective> {
    const now = this.clock.now();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return RunDirective.Stop;

    instance.begin(now);
    await this.instances.save(instance);
    return instance.directive();
  }
}
