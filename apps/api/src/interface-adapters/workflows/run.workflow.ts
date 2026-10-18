import {
  type SerializedWorkflowError,
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { Transactional } from '@nestjs-cls/transactional';
import type { EngineEnd, NodeOutcome } from '../../application/interfaces.js';
import { BeginRun } from '../../application/use-cases/begin-run.js';
import { ExecuteNode } from '../../application/use-cases/execute-node.js';
import { FinishRun } from '../../application/use-cases/finish-run.js';
import { ReachNode } from '../../application/use-cases/reach-node.js';
import { RecordNode } from '../../application/use-cases/record-node.js';
import { TerminateRun } from '../../application/use-cases/terminate-run.js';
import { Arrival, ErrorKind } from '../../domain/enums.js';
import { RunConflictError } from '../../domain/errors.js';
import { NodeRetry } from './node-retry.js';

export interface RunInstance {
  readonly runId: string;
  readonly workflowId: string;
}

@Workflow('automation.run', {
  concurrency: {
    limit: 5,
    key: (instance: RunInstance) => instance.workflowId,
  },
})
export class RunWorkflow implements WorkflowRunner<RunInstance, void> {
  static readonly NODE_ATTEMPTS = 100;
  static readonly ENGINE_ATTEMPTS = 3;
  static readonly RECORD_ROUNDS = 5;

  constructor(
    private readonly beginRun: BeginRun,
    private readonly reachNode: ReachNode,
    private readonly executeNode: ExecuteNode,
    private readonly recordNode: RecordNode,
    private readonly finishRun: FinishRun,
    private readonly terminateRun: TerminateRun,
  ) {}

  async run(ctx: WorkflowContext, instance: RunInstance): Promise<void> {
    const { runId } = instance;
    const order = await ctx.step('begin', () => this.begin(runId), {
      compensate: (_order, { reason }) => {
        const end = RunWorkflow.endOf(reason);
        return this.terminate(runId, end);
      },
    });

    for (const nodeId of order) {
      const arrival = await ctx.step(`reach:${nodeId}`, () =>
        this.reach(runId, nodeId),
      );

      if (arrival === Arrival.Stop) break;

      if (arrival === Arrival.Done) continue;

      await ctx.step(
        `execute:${nodeId}`,
        ({ attempt }) => this.attempt(runId, nodeId, attempt),
        {
          retry: {
            attempts: RunWorkflow.NODE_ATTEMPTS,
            backoff: (attempt, error) => RunWorkflow.waitAfter(attempt, error),
            retryIf: (error, attempt) =>
              error instanceof NodeRetry ||
              attempt < RunWorkflow.ENGINE_ATTEMPTS,
          },
        },
      );
    }

    await ctx.step('finish', () => this.finish(runId));
  }

  private async attempt(
    runId: string,
    nodeId: string,
    attempt: number,
  ): Promise<void> {
    const result = await this.executeNode.execute(runId, nodeId, attempt);

    if (result.retryInMs !== null) throw new NodeRetry(result.retryInMs);

    for (let round = 1; ; round++) {
      try {
        await this.record(runId, nodeId, attempt, result.outcome);
        return;
      } catch (error) {
        const again =
          error instanceof RunConflictError &&
          round < RunWorkflow.RECORD_ROUNDS;

        if (!again) throw error;
      }
    }
  }

  @Transactional()
  private begin(runId: string): Promise<string[]> {
    return this.beginRun.execute(runId);
  }

  @Transactional()
  private reach(runId: string, nodeId: string): Promise<Arrival> {
    return this.reachNode.execute(runId, nodeId);
  }

  @Transactional()
  private record(
    runId: string,
    nodeId: string,
    attempt: number,
    outcome: NodeOutcome,
  ): Promise<void> {
    return this.recordNode.execute(runId, nodeId, attempt, outcome);
  }

  @Transactional()
  private finish(runId: string): Promise<void> {
    return this.finishRun.execute(runId);
  }

  @Transactional()
  private terminate(runId: string, end: EngineEnd): Promise<void> {
    return this.terminateRun.execute(runId, end);
  }

  private static waitAfter(attempt: number, error: unknown): number {
    if (error instanceof NodeRetry) return error.waitMs;

    return 1_000 * 2 ** (attempt - 1);
  }

  static endOf(reason: SerializedWorkflowError): EngineEnd {
    if (reason.name === 'WorkflowTimeoutError') {
      return { kind: ErrorKind.Timeout, message: 'The run timed out' };
    }

    if (reason.name === 'WorkflowCancelledError') {
      return { kind: ErrorKind.Cancelled, message: 'The run was cancelled' };
    }

    return {
      kind: ErrorKind.Platform,
      message: 'The run stopped because of an internal error',
    };
  }
}
