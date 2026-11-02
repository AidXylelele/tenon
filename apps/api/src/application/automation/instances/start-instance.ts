import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UserOrigin } from '../../../domain/automation/instances/origins/user-origin.js';
import { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { VersionReference } from '../../../domain/automation/workflows/version-reference.js';
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
  type StartInstanceCommand,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class StartInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: StartInstanceCommand): Promise<WorkflowInstance> {
    const now = this.clock.now();
    const target = command.target;
    const workflow = await this.workflows.findByName(target.workflow);

    if (workflow === null) throw new WorkflowNotFoundError();

    const reference = VersionReference.forTarget(workflow, target);
    const version = await this.versions.findBy(reference);

    if (version === null) throw new VersionNotFoundError();

    const id = WorkflowInstance.idFor({
      userId: command.userId,
      workflowId: workflow.id,
      key: command.key,
    });
    const existing = await this.instances.find(id);

    if (existing !== null) return existing;

    const origin = new UserOrigin(command.userId);
    const instance = WorkflowInstance.start({
      id,
      workflow,
      version,
      input: command.input,
      origin,
      now,
    });
    await this.instances.save(instance);
    await this.runs.start(instance.id);
    return instance;
  }
}
