import type { RunRepository } from '../interfaces.js';

export class BeginRun {
  constructor(private readonly runs: RunRepository) {}

  async execute(runId: string): Promise<string[]> {
    const run = await this.runs.getById(runId);
    run.begin();
    await this.runs.update(run);
    return run.order.map((node) => node.id);
  }
}
