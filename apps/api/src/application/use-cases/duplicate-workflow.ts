import type { Workflow } from '../../domain/workflow.js';
import type {
  DuplicateWorkflowCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WebhookEndpointIssuer } from '../services/webhook-endpoint-issuer.js';

export class DuplicateWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly issuer: WebhookEndpointIssuer,
  ) {}

  async execute(command: DuplicateWorkflowCommand): Promise<Workflow> {
    const source = await this.workflows.getById(command.workflowId);
    const name = command.name ?? `${source.name} (copy)`;
    const ownedCredentialIds = new Set<string>();
    const copy = source.duplicate(name, command.actor.id, ownedCredentialIds);
    await this.workflows.add(copy);
    await this.issuer.issueFor(copy);
    return copy;
  }
}
