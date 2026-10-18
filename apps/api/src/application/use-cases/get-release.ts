import type {
  ReleaseQuery,
  ReleaseView,
  WorkflowQueries,
} from '../interfaces.js';

export class GetRelease {
  constructor(private readonly workflows: WorkflowQueries) {}

  execute(query: ReleaseQuery): Promise<ReleaseView> {
    return this.workflows.release(query.workflowId, query.number);
  }
}
