import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InstanceNotFoundError } from '../../../domain/errors.js';
import { EventRepository } from '../events/ports.js';
import { ReadVersionDefinition } from '../workflows/read-version-definition.js';
import {
  type BeginRoundCommand,
  type BegunRoundResult,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class BeginRound {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly readDefinition: ReadVersionDefinition,
    private readonly events: EventRepository,
  ) {}

  @Transactional()
  async execute(command: BeginRoundCommand): Promise<BegunRoundResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) throw new InstanceNotFoundError();

    const definition = await this.readDefinition.execute(instance.versionId);
    instance.beginRound(definition, command.runtime, command.now);
    await this.instances.save(instance);
    const produced = instance.takeProducedEvents();
    await this.events.addAll(produced);
    return { definition, instance };
  }
}
