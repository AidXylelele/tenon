import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
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
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: CompleteSubWorkflowCommand): Promise<void> {
    const now = this.clock.now();
    const parent = await this.instances.get(command.instanceId);

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
  }
}
