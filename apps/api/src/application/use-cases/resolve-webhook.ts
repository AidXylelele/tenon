import { TriggerType } from '../../domain/enums.js';
import { WebhookEndpointNotFoundError } from '../../domain/errors.js';
import { Graph } from '../../domain/graph.js';
import type {
  NodeTypeCatalog,
  ResolvedWebhook,
  SecretCipher,
  WebhookEndpointRepository,
  WorkflowQueries,
} from '../interfaces.js';

export class ResolveWebhook {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly workflows: WorkflowQueries,
    private readonly cipher: SecretCipher,
    private readonly catalogue: NodeTypeCatalog,
  ) {}

  async execute(endpointId: string): Promise<ResolvedWebhook> {
    const endpoint = await this.endpoints.findById(endpointId);

    if (!endpoint) throw new WebhookEndpointNotFoundError();

    const workflow = await this.workflows.get(endpoint.workflowId);

    if (workflow.archived || workflow.activeRelease === null) {
      throw new WebhookEndpointNotFoundError();
    }

    const release = await this.workflows.release(
      workflow.id,
      workflow.activeRelease,
    );
    const graph = new Graph(release.graph);
    const exists = graph.has(endpoint.nodeId);

    if (!exists) throw new WebhookEndpointNotFoundError();

    const node = graph.node(endpoint.nodeId);

    if (node.trigger !== TriggerType.Webhook || node.disabled) {
      throw new WebhookEndpointNotFoundError();
    }

    const settings = this.catalogue.webhookOf(node);
    const secret = this.cipher.decrypt(endpoint.secret);

    if (!settings || secret === null) throw new WebhookEndpointNotFoundError();

    return {
      endpointId: endpoint.id,
      workflowId: workflow.id,
      releaseNumber: release.number,
      nodeId: node.id,
      secret,
      settings,
    };
  }
}
