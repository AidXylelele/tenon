import type { Arrival } from '../../domain/enums.js';
import type { RunRepository } from '../interfaces.js';

export class ReachNode {
  constructor(private readonly runs: RunRepository) {}

  async execute(runId: string, nodeId: string): Promise<Arrival> {
    const run = await this.runs.getById(runId);
    const arrival = run.reach(nodeId);
    await this.runs.update(run);
    return arrival;
  }
}
