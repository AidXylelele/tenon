import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type {
  NodeSamples,
  UnpinSampleCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class UnpinSample {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly samples: NodeSamples,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: UnpinSampleCommand): Promise<void> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    workflow.unpin(command.nodeId);
    await this.samples.unpin(workflow.id, command.nodeId);
    await this.workflows.update(workflow);
  }
}
