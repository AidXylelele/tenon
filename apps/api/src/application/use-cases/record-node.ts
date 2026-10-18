import { RunMode } from '../../domain/enums.js';
import type { RunLimits } from '../../domain/interfaces.js';
import type { NodeOutcome, NodeSamples, RunRepository } from '../interfaces.js';

export class RecordNode {
  constructor(
    private readonly runs: RunRepository,
    private readonly samples: NodeSamples,
    private readonly limits: RunLimits,
  ) {}

  async execute(
    runId: string,
    nodeId: string,
    attempt: number,
    outcome: NodeOutcome,
  ): Promise<void> {
    const run = await this.runs.getById(runId);

    if (outcome.failure) {
      run.fail(nodeId, attempt, outcome.failure, outcome.outputs);
    } else {
      run.complete(nodeId, attempt, outcome.outputs, this.limits);
    }

    await this.runs.update(run);

    if (run.mode === RunMode.Test && outcome.fields.length > 0) {
      await this.samples.recordFields(run.workflowId, nodeId, outcome.fields);
    }
  }
}
