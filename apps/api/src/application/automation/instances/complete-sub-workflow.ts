import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InstanceNotFoundError } from '../../../domain/errors.js';
import { EventRepository } from '../events/ports.js';
import { Clock } from '../language/ports.js';
import { ReadVersionDefinition } from '../workflows/read-version-definition.js';
import {
  type CompleteSubWorkflowCommand,
  WorkflowInstanceRepository,
} from './ports.js';
import { InstanceQueries } from './queries.js';

@Injectable()
export class CompleteSubWorkflow {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly queries: InstanceQueries,
    private readonly readDefinition: ReadVersionDefinition,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: CompleteSubWorkflowCommand): Promise<void> {
    const now = this.clock.now();
    const parent = await this.instances.find(command.instanceId);

    if (parent === null) throw new InstanceNotFoundError();

    const ending = await this.queries.subWorkflowEnding(command.subWorkflowId);
    const definition = await this.readDefinition.execute(parent.versionId);
    parent.completeSubWorkflow(
      command.subWorkflowId,
      ending,
      definition,
      command.runtime,
      now,
    );
    await this.instances.save(parent);
    const produced = parent.takeProducedEvents();
    await this.events.addAll(produced);
  }
}
