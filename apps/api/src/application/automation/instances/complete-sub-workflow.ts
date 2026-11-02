import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RoundContext } from '../../../domain/automation/instances/round-context.js';
import { Clock } from '../language/ports.js';
import { ReadVersionDefinition } from '../workflows/read-version-definition.js';
import {
  type CompleteSubWorkflowCommand,
  WorkflowInstanceRepository,
} from './ports.js';
import { SubWorkflowQueries } from './queries.js';

@Injectable()
export class CompleteSubWorkflow {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly queries: SubWorkflowQueries,
    private readonly readDefinition: ReadVersionDefinition,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: CompleteSubWorkflowCommand): Promise<void> {
    const now = this.clock.now();
    const parent = await this.instances.get(command.instanceId);

    const ending = await this.queries.endingOf(command.subWorkflowId);
    const definition = await this.readDefinition.execute(parent.versionId);
    const context = new RoundContext({
      definition,
      runtime: command.runtime,
      now,
    });
    parent.completeSubWorkflow(command.subWorkflowId, ending, context);
    await this.instances.save(parent);
  }
}
