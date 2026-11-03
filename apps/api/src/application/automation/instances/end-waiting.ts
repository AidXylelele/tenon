import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { type InstanceCommand, WorkflowInstanceRepository } from './ports.js';

// The wait ended: the instance runs again.
@Injectable()
export class EndWaiting {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    instance.endWaiting();
    await this.instances.save(instance);
  }
}
