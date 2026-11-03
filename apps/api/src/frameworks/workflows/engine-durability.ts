import {
  StepFailedError,
  type WorkflowContext,
  type WorkflowRetryOptions,
} from '@nestjs/workflows';
import type { JsonObject } from '../../domain/automation/json.js';
import { TaskFault } from '../runtime/execution/faults.js';
import type {
  Durability,
  GoJudgeCommand,
  StepOptions,
  StepRetry,
} from '../runtime/interfaces.js';
import { RESUME_SIGNAL } from './engine.constants.js';
import type { StepErrors } from './step-errors.js';

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
  ) {}

  now(): number {
    return this.ctx.now();
  }

  async step<T>(
    name: string,
    effect: (attempt: number) => Promise<T>,
    options: StepOptions,
  ): Promise<T> {
    const retry = EngineDurability.#retryOf(options.retry);

    try {
      const result = await this.ctx.step(
        name,
        (step) => this.errors.classified(() => effect(step.attempt)),
        { retry },
      );
      return result as T;
    } catch (error) {
      const spent =
        error instanceof StepFailedError &&
        error.cause.name === EngineDurability.RETRYABLE;

      if (!spent) throw error;

      const fault = JSON.parse(error.cause.message) as JsonObject;
      throw new TaskFault(fault);
    }
  }

  async sleep(name: string, milliseconds: number): Promise<void> {
    await this.ctx.sleep(name, milliseconds);
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

  // A retry policy's own attempts and delays, with a reserve for outages of the platform.
  static #retryOf(retry: StepRetry | null): WorkflowRetryOptions {
    if (retry === null) return EngineDurability.OUTAGE;

    const attempts = Math.min(
      retry.attempts + EngineDurability.OUTAGE_ATTEMPTS,
      Number.MAX_SAFE_INTEGER,
    );
    return {
      attempts,
      backoff: (attempt, error) => {
        if (retry.retries(error)) return retry.backoff(attempt);

        const grown = EngineDurability.OUTAGE_DELAY_MS * 2 ** (attempt - 1);
        return Math.min(grown, EngineDurability.OUTAGE_MAX_DELAY_MS);
      },
    };
  }
}
