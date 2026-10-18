import { Graph } from '../../domain/graph.js';
import type {
  WorkflowDetails,
  WorkflowQueries,
  WorkflowQuery,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';
import type { ConfigurationCheck } from '../services/configuration-check.js';

export class GetWorkflow {
  constructor(
    private readonly workflows: WorkflowQueries,
    private readonly check: ConfigurationCheck,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(query: WorkflowQuery): Promise<WorkflowDetails> {
    const workflow = await this.workflows.get(query.workflowId);
    const graph = new Graph(workflow.graph);
    return {
      workflow,
      problems: this.check.problemsOf(graph),
      canManage: this.policy.manage(query.actor, {
        ownerId: workflow.owner.id,
      }),
    };
  }
}
