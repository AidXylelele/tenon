import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type {
  NodeSamples,
  PinSampleCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class PinSample {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly samples: NodeSamples,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: PinSampleCommand): Promise<void> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    workflow.pin(command.nodeId);
    await this.samples.pin(workflow.id, command.nodeId, command.items);
    await this.workflows.update(workflow);
  }
}
