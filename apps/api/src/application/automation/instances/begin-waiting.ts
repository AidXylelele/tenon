import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { type InstanceCommand, WorkflowInstanceRepository } from './ports.js';

// A wait or a listen began: the instance is waiting.
@Injectable()
export class BeginWaiting {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    instance.beginWaiting();
    await this.instances.save(instance);
  }
}
