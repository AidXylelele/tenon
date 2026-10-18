import type { RunQueries, RunView } from '../interfaces.js';

export class GetRun {
  constructor(private readonly runs: RunQueries) {}

  execute(runId: string): Promise<RunView> {
    return this.runs.get(runId);
  }
}
