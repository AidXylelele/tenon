import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Clock } from '../ports.js';
import {
  type EndInstanceCommand,
  WorkflowInstanceRepository,
} from './ports.js';

// The run faulted: the instance keeps its error, unless it ended before.
@Injectable()
export class FaultInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: EndInstanceCommand): Promise<void> {
    const now = this.clock.now();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const error = command.error ?? {};
    instance.fault(error, now);
    await this.instances.save(instance);
  }
}
