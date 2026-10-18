import type { RunQueries } from '../interfaces.js';

export class ListStaleRuns {
  static readonly LIMIT = 100;

  constructor(private readonly runs: RunQueries) {}

  execute(before: Date): Promise<string[]> {
    return this.runs.unfinishedBefore(before, ListStaleRuns.LIMIT);
  }
}
