import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Clock } from '../language/ports.js';
import {
  type FaultInstanceCommand,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class FaultInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: FaultInstanceCommand): Promise<void> {
    const now = this.clock.now();
    const instance = await this.instances.get(command.instanceId);

    instance.fault(now);
    await this.instances.save(instance);
  }
}
