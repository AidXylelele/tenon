import { TriggerType } from '../../domain/enums.js';
import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import { Graph } from '../../domain/graph.js';
import type {
  NodeTypeCatalog,
  SecretCipher,
  WebhookEndpointRepository,
  WebhookEndpointView,
  WorkflowQueries,
  WorkflowQuery,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class ListWebhookEndpoints {
  constructor(
    private readonly workflows: WorkflowQueries,
    private readonly endpoints: WebhookEndpointRepository,
    private readonly cipher: SecretCipher,
    private readonly catalogue: NodeTypeCatalog,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(query: WorkflowQuery): Promise<WebhookEndpointView[]> {
    const workflow = await this.workflows.get(query.workflowId);
    const allowed = this.policy.manage(query.actor, {
      ownerId: workflow.owner.id,
    });

    if (!allowed) throw new WorkflowAccessDeniedError();

    const graph = new Graph(workflow.graph);
    const endpoints = await this.endpoints.listByWorkflow(workflow.id);
    const views: WebhookEndpointView[] = [];

    for (const node of graph.triggersOf(TriggerType.Webhook)) {
      const endpoint = endpoints.find(
        (candidate) => candidate.nodeId === node.id,
      );

      if (!endpoint) continue;

      const secret = this.cipher.decrypt(endpoint.secret);
      const settings = this.catalogue.webhookOf(node);
      views.push({
        endpointId: endpoint.id,
        nodeId: node.id,
        secret,
        settings,
      });
    }

    return views;
  }
}
