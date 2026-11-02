import { Injectable } from '@nestjs/common';
import { RunnableVersion } from '../../../domain/automation/workflows/runnable-version.js';
import { Transactional } from '@nestjs-cls/transactional';
import { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import {
  VersionNotFoundError,
  WorkflowNotFoundError,
} from '../../../domain/errors.js';
import { Clock } from '../language/ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import {
  InstanceRuns,
  type StartDetachedWorkflowCommand,
  WorkflowInstanceRepository,
} from './ports.js';
import { SubWorkflowQueries } from './queries.js';

@Injectable()
export class StartDetachedWorkflow {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly queries: SubWorkflowQueries,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly runs: InstanceRuns,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: StartDetachedWorkflowCommand): Promise<void> {
    const now = this.clock.now();
    const exists = await this.queries.exists(command.subWorkflowId);

    if (exists) return;

    const workflow = await this.workflows.findByName(command.workflow);

    if (workflow === null) throw new WorkflowNotFoundError();

    const version = await this.versions.findBy(command.version);

    if (version === null) throw new VersionNotFoundError();

    const runnable = new RunnableVersion({ workflow, version });
    const subWorkflow = WorkflowInstance.startSubWorkflow({
      id: command.subWorkflowId,
      parentId: command.parentId,
      taskId: command.taskInstanceId,
      runnable,
      input: command.input,
      now,
    });
    await this.instances.save(subWorkflow);
    await this.runs.start(subWorkflow.id);
  }
}
