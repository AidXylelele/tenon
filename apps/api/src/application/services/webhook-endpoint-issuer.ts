import { TriggerType } from '../../domain/enums.js';
import { WebhookEndpoint } from '../../domain/webhook-endpoint.js';
import { WebhookSecret } from '../../domain/webhook-secret.js';
import type { Workflow } from '../../domain/workflow.js';
import type { SecretCipher, WebhookEndpointRepository } from '../interfaces.js';

export class WebhookEndpointIssuer {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly cipher: SecretCipher,
  ) {}

  async issueFor(workflow: Workflow): Promise<void> {
    for (const node of workflow.graph.triggersOf(TriggerType.Webhook)) {
      const existing = await this.endpoints.findByNode(workflow.id, node.id);

      if (existing) continue;

      const secret = WebhookSecret.generate();
      const encrypted = this.cipher.encrypt(secret.value);
      const endpoint = WebhookEndpoint.open(workflow.id, node.id, encrypted);
      await this.endpoints.add(endpoint);
    }
  }
}
