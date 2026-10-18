import {
  InvalidOwnerError,
  WorkflowAccessDeniedError,
} from '../../domain/errors.js';
import type { Workflow } from '../../domain/workflow.js';
import type {
  TransferWorkflowCommand,
  UserRepository,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class TransferWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly users: UserRepository,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: TransferWorkflowCommand): Promise<Workflow> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const owner = await this.users.findActiveById(command.ownerId);

    if (!owner) throw new InvalidOwnerError();

    const canAuthor = this.policy.author(owner);

    if (!canAuthor) throw new InvalidOwnerError();

    workflow.transferTo(owner.id);
    await this.workflows.update(workflow);
    return workflow;
  }
}
