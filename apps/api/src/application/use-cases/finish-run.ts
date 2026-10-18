import type { RunRepository } from '../interfaces.js';

export class FinishRun {
  constructor(private readonly runs: RunRepository) {}

  async execute(runId: string): Promise<void> {
    const run = await this.runs.getById(runId);
    run.finish();
    await this.runs.update(run);
  }
}
