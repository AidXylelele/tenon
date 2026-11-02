import {
  type ChildWorkflowHandle,
  isWorkflowInterrupt,
  Workflow,
  type WorkflowCondition,
  type WorkflowContext,
  type WorkflowRetryOptions,
  type WorkflowRunner,
} from '@nestjs/workflows';
import {
  RoundProgressKind,
  SubWorkflowStepKind,
} from '../../interface-adapters/workflows/runs/enums.js';
import { InstanceRunController } from '../../interface-adapters/workflows/runs/instance-run.controller.js';
import type {
  InstanceRunInput,
  RoundProgress,
} from '../../interface-adapters/workflows/runs/interfaces.js';
import { StepErrors } from './step-errors.js';

@Workflow('instance', { version: 1 })
export class InstanceWorkflow implements WorkflowRunner<
  InstanceRunInput,
  void
> {
  private static readonly FIRST_BUSY_MS = 1_000;
  private static readonly LAST_BUSY_MS = 30_000;
  private static readonly BUDGET_MS = 10_000;
  // A PostgreSQL failover of several minutes delays an instance instead of faulting it.
  private static readonly STEPS: WorkflowRetryOptions = {
    attempts: 10,
    backoff: { delay: '1s', maxDelay: '1m', jitter: 'equal' },
  };

  constructor(
    private readonly controller: InstanceRunController,
    private readonly errors: StepErrors,
  ) {}

  async run(ctx: WorkflowContext, input: InstanceRunInput): Promise<void> {
    const instanceId = input.instanceId;
    const attempted = new Set<string>();
    const awaited = new Map<string, ChildWorkflowHandle<void>>();
    let busy = InstanceWorkflow.FIRST_BUSY_MS;

    for (let round = 1; ; round += 1) {
      try {
        const attemptedIds = Array.from(attempted);
        const firstRound = round === 1;
        const compensation = {
          compensate: () =>
            this.errors.classified(() => this.controller.fault(instanceId)),
        };
        const options = firstRound
          ? { retry: InstanceWorkflow.STEPS, ...compensation }
          : { retry: InstanceWorkflow.STEPS };
        const progress = await ctx.step(
          `advance-${String(round)}`,
          () =>
            this.errors.classified(() =>
              this.#untilParked(instanceId, attemptedIds),
            ),
          options,
        );

        if (progress === null || progress.kind === RoundProgressKind.Ended)
          return;

        let changed = false;

        for (const subWorkflowId of progress.subWorkflows) {
          if (attempted.has(subWorkflowId)) continue;

          attempted.add(subWorkflowId);
          const step = await ctx.step(
            `start-${subWorkflowId}`,
            () =>
              this.errors.classified(() =>
                this.controller.start(instanceId, subWorkflowId),
              ),
            { retry: InstanceWorkflow.STEPS },
          );

          if (step === null) return;

          changed = true;

          if (step !== SubWorkflowStepKind.Started) continue;

          const handle = await ctx.startChild(
            InstanceWorkflow,
            { instanceId: subWorkflowId },
            { id: subWorkflowId, parentClose: 'abandon' },
          );
          awaited.set(subWorkflowId, handle);
        }

        if (changed) continue;

        if (progress.kind === RoundProgressKind.Busy) {
          await ctx.sleep(`busy-${String(round)}`, busy);
          busy = Math.min(busy * 2, InstanceWorkflow.LAST_BUSY_MS);
          continue;
        }

        busy = InstanceWorkflow.FIRST_BUSY_MS;

        if (progress.kind === RoundProgressKind.Run) continue;

        const conditions: Record<string, WorkflowCondition> = {};

        if (progress.wakeAt !== null)
          conditions.timer = ctx.timer({ until: progress.wakeAt });

        for (const [subWorkflowId, handle] of awaited)
          conditions[subWorkflowId] = handle;

        const winner = await ctx.waitForAny(
          `park-${String(round)}`,
          conditions,
        );

        if (!awaited.has(winner.key)) continue;

        awaited.delete(winner.key);
        const recorded = await ctx.step(
          `ended-${String(round)}`,
          () =>
            this.errors.classified(async () => {
              await this.controller.ended(instanceId, winner.key);
              return true;
            }),
          { retry: InstanceWorkflow.STEPS },
        );

        if (recorded === null) return;
      } catch (error) {
        if (isWorkflowInterrupt(error)) throw error;

        await ctx.step(
          `fault-${String(round)}`,
          () => this.errors.classified(() => this.controller.fault(instanceId)),
          { retry: InstanceWorkflow.STEPS },
        );
        return;
      }
    }
  }

  // Rounds repeat within one step while the instance can run on, so a short run costs one entry.
  async #untilParked(
    instanceId: string,
    attempted: readonly string[],
  ): Promise<RoundProgress> {
    const deadline = performance.now() + InstanceWorkflow.BUDGET_MS;

    for (;;) {
      const progress = await this.controller.advance(instanceId);
      const listsNew = progress.subWorkflows.some(
        (id) => !attempted.includes(id),
      );
      const spent = performance.now() >= deadline;
      const runsOn = progress.kind === RoundProgressKind.Run;

      if (!runsOn || listsNew || spent) return progress;
    }
  }
}
