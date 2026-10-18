import { Run } from '../../domain/run.js';
import type {
  NodeAttempt,
  NodeExecutor,
  RunRepository,
} from '../interfaces.js';

export class ExecuteNode {
  constructor(
    private readonly runs: RunRepository,
    private readonly executor: NodeExecutor,
  ) {}

  async execute(
    runId: string,
    nodeId: string,
    attempt: number,
  ): Promise<NodeAttempt> {
    const run = await this.runs.getById(runId);

    if (run.isFinished) {
      return {
        outcome: { outputs: [], failure: Run.ENDED_BEFORE_START, fields: [] },
        retryInMs: null,
      };
    }

    const input = run.inputOf(nodeId);
    const outcome = await this.executor.execute({ run, input, attempt });
    const retryInMs = outcome.failure
      ? input.node.retryDelay(outcome.failure, attempt)
      : null;
    return { outcome, retryInMs };
  }
}
