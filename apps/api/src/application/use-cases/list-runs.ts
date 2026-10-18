import type {
  Page,
  RunFilter,
  RunQueries,
  RunSummary,
  WorkflowQueries,
} from '../interfaces.js';

export class ListRuns {
  constructor(
    private readonly workflows: WorkflowQueries,
    private readonly runs: RunQueries,
  ) {}

  async execute(
    workflowId: string,
    filter: RunFilter,
  ): Promise<Page<RunSummary>> {
    await this.workflows.get(workflowId);
    return this.runs.list(workflowId, filter);
  }
}
