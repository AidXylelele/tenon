import {
  StepFailedError,
  type WorkflowContext,
  type WorkflowRetryOptions,
  type WorkflowStepContext,
} from '@nestjs/workflows';
import type { JsonObject } from '../../domain/automation/json.js';
import type { EngineTime } from '../../interface-adapters/workflows/runs/interfaces.js';
import {
  type RetriedFault,
  RetriesSpentFault,
  RetryableFault,
} from '../runtime/execution/faults.js';
import type {
  Durability,
  GoJudgeCommand,
  StepOptions,
  StepRetry,
} from '../runtime/interfaces.js';
import { EVENT_SIGNAL, RESUME_SIGNAL } from './engine.constants.js';
import type { StepErrors } from './step-errors.js';

// A step's progress checkpoint: the last attempt a retry policy retried.
interface RetriedAttempt {
  readonly attempt: number;
}

// The runtime's durability on @nestjs/workflows: a step is `ctx.step`, a sleep `ctx.sleep`, a
// held run waits for the resume signal. The engine also repeats a step through an outage of the
// platform (a PostgreSQL failover of several minutes delays an instance rather than faulting it).
export class EngineDurability implements Durability {
  private static readonly OUTAGE_ATTEMPTS = 10;
  private static readonly OUTAGE: WorkflowRetryOptions = {
    attempts: EngineDurability.OUTAGE_ATTEMPTS,
    backoff: { delay: '1s', maxDelay: '1m', jitter: 'equal' },
  };
  private static readonly OUTAGE_DELAY_MS = 1_000;
  private static readonly OUTAGE_MAX_DELAY_MS = 60_000;
  private static readonly RETRYABLE = 'RetryableFault';
  private static readonly INSTANCE = 'instance';
  private static readonly PROCESS = 'process';

  constructor(
    private readonly ctx: WorkflowContext,
    private readonly errors: StepErrors,
    private readonly instanceId: string,
    private readonly time: EngineTime,
  ) {}

  stepTime(): number {
    return this.time.now();
  }

  async step<T>(
    name: string,
    effect: (attempt: number) => Promise<T>,
    options: StepOptions,
  ): Promise<T> {
    const retry = EngineDurability.#retryOf(options.retry);

    try {
      const result = await this.ctx.step<T, RetriedAttempt>(
        name,
        (step) => this.#attempted(step, effect),
        { retry },
      );
      return result as T;
    } catch (error) {
      const spent =
        error instanceof StepFailedError &&
        error.cause.name === EngineDurability.RETRYABLE;

      if (!spent) throw error;

      const retried = JSON.parse(error.cause.message) as RetriedFault;
      throw new RetriesSpentFault(retried.error, retried.attempt);
    }
  }

  // The attempt a retry policy counts: one after the last it retried, which the step checkpoints
  // as its progress. A repeat after an outage or a crash finds the same checkpoint, so it runs
  // the same attempt again (the engine's own attempt counts both).
  async #attempted<T>(
    step: WorkflowStepContext<RetriedAttempt>,
    effect: (attempt: number) => Promise<T>,
  ): Promise<T> {
    const retried = step.progress?.attempt ?? 0;
    const attempt = retried + 1;

    try {
      return await this.errors.classified(() => effect(attempt));
    } catch (error) {
      if (error instanceof RetryableFault) {
        const checkpoint: RetriedAttempt = { attempt };
        await step.heartbeat(checkpoint);
      }

      throw error;
    }
  }

  async sleep(name: string, milliseconds: number): Promise<void> {
    await this.ctx.sleep(name, milliseconds);
  }

  async waitForEvent(
    name: string,
    key: string,
    milliseconds: number | null,
  ): Promise<JsonObject | null> {
    const options =
      milliseconds === null ? { key } : { key, timeout: milliseconds };
    // Journaled<JsonObject> recurses too deep for the compiler: the payload is a CloudEvent object.
    const event = await this.ctx.waitForSignal<unknown>(
      name,
      EVENT_SIGNAL,
      options,
    );
    return event as JsonObject | null;
  }

  async awaitChild(name: string, instanceId: string): Promise<void> {
    await this.ctx.executeChild(
      EngineDurability.INSTANCE,
      { instanceId },
      { id: instanceId },
    );
  }

  async detachChild(name: string, instanceId: string): Promise<void> {
    await this.ctx.startChild(
      EngineDurability.INSTANCE,
      { instanceId },
      {
        id: instanceId,
        parentClose: 'abandon',
      },
    );
  }

  async detachProcess(name: string, command: GoJudgeCommand): Promise<void> {
    const id = `${this.instanceId}${name}`;
    await this.ctx.startChild(
      EngineDurability.PROCESS,
      { command },
      {
        id,
        parentClose: 'abandon',
      },
    );
  }

  async waitForResume(name: string, milliseconds: number): Promise<void> {
    await this.ctx.waitForSignal(name, RESUME_SIGNAL, {
      key: this.instanceId,
      timeout: milliseconds,
    });
  }

  // A retry policy's own attempts, each after the delay its fault carries, with a reserve for
  // outages of the platform.
  static #retryOf(retry: StepRetry | null): WorkflowRetryOptions {
    if (retry === null) return EngineDurability.OUTAGE;

    const attempts = Math.min(
      retry.attempts + EngineDurability.OUTAGE_ATTEMPTS,
      Number.MAX_SAFE_INTEGER,
    );
    return {
      attempts,
      backoff: (attempt, error) => {
        if (error instanceof RetryableFault) return error.delay;

        const grown = EngineDurability.OUTAGE_DELAY_MS * 2 ** (attempt - 1);
        return Math.min(grown, EngineDurability.OUTAGE_MAX_DELAY_MS);
      },
    };
  }
}
