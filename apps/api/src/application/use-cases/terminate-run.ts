import type { EngineEnd, RunRepository } from '../interfaces.js';

export class TerminateRun {
  constructor(private readonly runs: RunRepository) {}

  async execute(runId: string, end: EngineEnd): Promise<void> {
    const run = await this.runs.getById(runId);
    run.terminate({ nodeId: null, kind: end.kind, message: end.message });
    await this.runs.update(run);
  }
}
