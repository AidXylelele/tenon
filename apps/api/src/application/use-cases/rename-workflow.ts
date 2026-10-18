import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { Workflow } from '../../domain/workflow.js';
import type {
  RenameWorkflowCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class RenameWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: RenameWorkflowCommand): Promise<Workflow> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    workflow.rename(command.name);
    await this.workflows.update(workflow);
    return workflow;
  }
}
