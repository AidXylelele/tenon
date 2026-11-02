import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InstanceNotFoundError } from '../../../domain/errors.js';
import { EventRepository } from '../events/ports.js';
import { Clock } from '../language/ports.js';
import {
  type FaultInstanceCommand,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class FaultInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: FaultInstanceCommand): Promise<void> {
    const now = this.clock.now();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) throw new InstanceNotFoundError();

    instance.fault(now);
    await this.instances.save(instance);
    const produced = instance.takeProducedEvents();
    await this.events.addAll(produced);
  }
}
