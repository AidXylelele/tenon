import { Injectable } from '@nestjs/common';
import { RunDirective } from '../../../domain/automation/instances/enums.js';
import { type InstanceCommand, WorkflowInstanceRepository } from './ports.js';

// What the run does now, asked by a run that a suspension held.
@Injectable()
export class InstanceDirective {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  async execute(command: InstanceCommand): Promise<RunDirective> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return RunDirective.Stop;

    return instance.directive();
  }
}
