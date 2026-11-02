import {
  isWorkflowInterrupt,
  type Journaled,
  Workflow,
  type WorkflowCondition,
  type WorkflowContext,
  type WorkflowRetryOptions,
  type WorkflowRunner,
  type WorkflowStepOptions,
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
import { RoundTurn } from './enums.js';
import { RunState } from './run-state.js';
import { StepErrors } from './step-errors.js';

// The run of one instance (architecture §4): rounds until the instance ends, starting the
// sub-workflows it asks for, resting while capacity is short and parking until it is due.
@Workflow('instance', { version: 1 })
export class InstanceWorkflow implements WorkflowRunner<
  InstanceRunInput,
  void
> {
  private static readonly BUDGET_MS = 10_000;
  // A PostgreSQL failover of several minutes delays an instance instead of faulting it.
  private static readonly STEP_RETRY: WorkflowRetryOptions = {
    attempts: 10,
    backoff: { delay: '1s', maxDelay: '1m', jitter: 'equal' },
  };

  constructor(
    private readonly controller: InstanceRunController,
    private readonly errors: StepErrors,
  ) {}

  async run(ctx: WorkflowContext, input: InstanceRunInput): Promise<void> {
    const run = new RunState(input.instanceId);

    for (let round = 1; ; round += 1) {
      try {
        const turn = await this.#round(ctx, run, round);

        if (turn === RoundTurn.Stop) return;
      } catch (error) {
        if (isWorkflowInterrupt(error)) throw error;

        await this.#step(ctx, `fault-${String(round)}`, () =>
          this.controller.fault(run.instanceId),
        );
        return;
      }
    }
  }

  async #round(
    ctx: WorkflowContext,
    run: RunState,
    round: number,
  ): Promise<RoundTurn> {
    const progress = await this.#advance(ctx, run, round);

    if (progress === null || progress.kind === RoundProgressKind.Ended)
      return RoundTurn.Stop;

    const requested = run.unattempted(progress.subWorkflows);

    if (requested.length > 0) return this.#startAll(ctx, run, requested);

    if (progress.kind === RoundProgressKind.Busy)
      return this.#rest(ctx, run, round, progress.wakeAt);

    run.rested();

    if (progress.kind === RoundProgressKind.Run) return RoundTurn.Next;

    return this.#park(ctx, run, round, progress.wakeAt);
  }

  // The first round's step registers the fault as its compensation (architecture §4).
  #advance(
    ctx: WorkflowContext,
    run: RunState,
    round: number,
  ): Promise<Journaled<RoundProgress | null>> {
    const name = `advance-${String(round)}`;
    const work = (signal: AbortSignal) => this.#untilParked(run, signal);

    if (round > 1) return this.#step(ctx, name, work);

    const compensate = () =>
      this.errors.classified(() => this.controller.fault(run.instanceId));
    return this.#step(ctx, name, work, { compensate });
  }

  async #startAll(
    ctx: WorkflowContext,
    run: RunState,
    requested: readonly string[],
  ): Promise<RoundTurn> {
    for (const subWorkflowId of requested) {
      run.attempt(subWorkflowId);
      const started = await this.#step(ctx, `start-${subWorkflowId}`, () =>
        this.controller.startSubWorkflow(run.instanceId, subWorkflowId),
      );

      if (started === null) return RoundTurn.Stop;

      if (started !== SubWorkflowStepKind.Started) continue;

      const child = { instanceId: subWorkflowId };
      const handle = await ctx.startChild(InstanceWorkflow, child, {
        id: subWorkflowId,
        parentClose: 'abandon',
      });
      run.await(subWorkflowId, handle);
    }

    return RoundTurn.Next;
  }

  // Deferred work waits a growing pause, which a due deadline or an awaited child ends early.
  #rest(
    ctx: WorkflowContext,
    run: RunState,
    round: number,
    wakeAt: number | null,
  ): Promise<RoundTurn> {
    const pause = run.busy();
    const conditions = run.conditions(ctx, wakeAt);
    conditions.rest = ctx.timer(pause);
    return this.#waitFor(ctx, run, `busy-${String(round)}`, round, conditions);
  }

  #park(
    ctx: WorkflowContext,
    run: RunState,
    round: number,
    wakeAt: number | null,
  ): Promise<RoundTurn> {
    const conditions = run.conditions(ctx, wakeAt);
    return this.#waitFor(ctx, run, `park-${String(round)}`, round, conditions);
  }

  async #waitFor(
    ctx: WorkflowContext,
    run: RunState,
    name: string,
    round: number,
    conditions: Record<string, WorkflowCondition>,
  ): Promise<RoundTurn> {
    const winner = await ctx.waitForAny(name, conditions);
    const ended = run.ended(winner.key);

    if (!ended) return RoundTurn.Next;

    // `true`, because a settled error journals as `null`.
    const recorded = await this.#step(
      ctx,
      `ended-${String(round)}`,
      async () => {
        await this.controller.completeSubWorkflow(run.instanceId, winner.key);
        return true;
      },
    );

    if (recorded === null) return RoundTurn.Stop;

    return RoundTurn.Next;
  }

  // Every step classifies its errors inside the step, because the journal keeps no error class,
  // and retries transient ones alike.
  #step<T>(
    ctx: WorkflowContext,
    name: string,
    work: (signal: AbortSignal) => Promise<T>,
    options: WorkflowStepOptions<T | null> = {},
  ): Promise<Journaled<T | null>> {
    const retried: WorkflowStepOptions<T | null> = {
      retry: InstanceWorkflow.STEP_RETRY,
      compensate: options.compensate,
    };
    return ctx.step(
      name,
      ({ signal }) => this.errors.classified(() => work(signal)),
      retried,
    );
  }

  // Rounds repeat within one step while the instance can run on, so a short run costs one entry.
  // The step's signal (a shutdown, a lost lease) lets the round in progress end but starts no
  // other, so a worker that lost the instance repeats no work its successor took over.
  async #untilParked(
    run: RunState,
    signal: AbortSignal,
  ): Promise<RoundProgress> {
    const deadline = performance.now() + InstanceWorkflow.BUDGET_MS;

    for (;;) {
      const progress = await this.controller.advance(run.instanceId);
      const requested = run.unattempted(progress.subWorkflows);
      const listsNew = requested.length > 0;
      const spent = performance.now() >= deadline;
      const runsOn = progress.kind === RoundProgressKind.Run;

      if (!runsOn || listsNew || spent || signal.aborted) return progress;
    }
  }
}
