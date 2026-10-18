import type { WorkflowQueries } from '../interfaces.js';

export class ListActiveWorkflows {
  constructor(private readonly workflows: WorkflowQueries) {}

  execute(): Promise<string[]> {
    return this.workflows.activeIds();
  }
}
