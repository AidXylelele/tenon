import type { ReleaseSummary, WorkflowQueries } from '../interfaces.js';

export class ListReleases {
  constructor(private readonly workflows: WorkflowQueries) {}

  async execute(workflowId: string): Promise<ReleaseSummary[]> {
    await this.workflows.get(workflowId);
    return this.workflows.releases(workflowId);
  }
}
