import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { InstanceProgress } from '../../../domain/automation/instances/interfaces.js';
import { InstanceNotFoundError } from '../../../domain/errors.js';
import { EventRepository } from '../events/ports.js';
import {
  type RecordRoundCommand,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class RecordRound {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly events: EventRepository,
  ) {}

  @Transactional()
  async execute(command: RecordRoundCommand): Promise<InstanceProgress> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) throw new InstanceNotFoundError();

    for (const results of command.recorded)
      instance.record(
        results,
        command.definition,
        command.runtime,
        command.now,
      );

    await this.instances.save(instance);
    const produced = instance.takeProducedEvents();
    await this.events.addAll(produced);
    return instance.progress(command.now);
  }
}
