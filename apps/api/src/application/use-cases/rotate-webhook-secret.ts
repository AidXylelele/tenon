import { TriggerType } from '../../domain/enums.js';
import {
  WebhookEndpointNotFoundError,
  WorkflowAccessDeniedError,
} from '../../domain/errors.js';
import { WebhookSecret } from '../../domain/webhook-secret.js';
import type {
  NodeTypeCatalog,
  SecretCipher,
  WebhookCommand,
  WebhookEndpointRepository,
  WebhookEndpointView,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class RotateWebhookSecret {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly endpoints: WebhookEndpointRepository,
    private readonly cipher: SecretCipher,
    private readonly catalogue: NodeTypeCatalog,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: WebhookCommand): Promise<WebhookEndpointView> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const node = workflow.graph.node(command.nodeId);

    if (node.trigger !== TriggerType.Webhook) {
      throw new WebhookEndpointNotFoundError();
    }

    const endpoint = await this.endpoints.findByNode(workflow.id, node.id);

    if (!endpoint) throw new WebhookEndpointNotFoundError();

    const secret = WebhookSecret.generate();
    const encrypted = this.cipher.encrypt(secret.value);
    endpoint.rotate(encrypted);
    await this.endpoints.update(endpoint);
    return {
      endpointId: endpoint.id,
      nodeId: node.id,
      secret: secret.value,
      settings: this.catalogue.webhookOf(node),
    };
  }
}
