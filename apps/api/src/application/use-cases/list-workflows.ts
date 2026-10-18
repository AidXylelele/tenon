import type {
  Page,
  WorkflowFilter,
  WorkflowQueries,
  WorkflowSummary,
} from '../interfaces.js';

export class ListWorkflows {
  constructor(private readonly workflows: WorkflowQueries) {}

  execute(filter: WorkflowFilter): Promise<Page<WorkflowSummary>> {
    return this.workflows.list(filter);
  }
}
