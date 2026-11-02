import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { VersionReference } from '../../../domain/automation/workflows/version-reference.js';
import { Clock } from '../language/ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import { ReadVersionDefinition } from '../workflows/read-version-definition.js';
import { SubWorkflowStartKind } from './enums.js';
import {
  type StartedSubWorkflowResult,
  type StartSubWorkflowCommand,
  WorkflowInstanceRepository,
} from './ports.js';
import { InstanceQueries } from './queries.js';

@Injectable()
export class StartSubWorkflow {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly queries: InstanceQueries,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly readDefinition: ReadVersionDefinition,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(
    command: StartSubWorkflowCommand,
  ): Promise<StartedSubWorkflowResult> {
    const now = this.clock.now();
    const parent = await this.instances.get(command.instanceId);

    const request = parent.requestedSubWorkflow(command.subWorkflowId);

    if (request === null) return { kind: SubWorkflowStartKind.Answered };

    const exists = await this.queries.exists(command.subWorkflowId);

    if (exists) return { kind: SubWorkflowStartKind.Started };

    const target = request.target;
    const workflow = await this.workflows.findByName(target.workflow);
    const reference = VersionReference.forTarget(workflow, target);
    const version = await this.versions.findBy(reference);
    const definition = await this.readDefinition.execute(parent.versionId);
    const subWorkflow = parent.answerSubWorkflow(
      command.subWorkflowId,
      workflow,
      version,
      definition,
      command.runtime,
      now,
    );

    if (subWorkflow !== null) {
      await this.instances.save(subWorkflow);
      return { kind: SubWorkflowStartKind.Started };
    }

    await this.instances.save(parent);
    return { kind: SubWorkflowStartKind.Answered };
  }
}
