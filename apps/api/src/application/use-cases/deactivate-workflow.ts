import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { WorkflowCommand, WorkflowRepository } from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class DeactivateWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: WorkflowCommand): Promise<void> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    workflow.deactivate();
    await this.workflows.update(workflow);
  }
}
