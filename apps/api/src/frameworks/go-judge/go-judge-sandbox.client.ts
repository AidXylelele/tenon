import { Injectable, Logger } from '@nestjs/common';
import {
  BulkheadFullError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { SandboxOutcomeKind } from '../../interface-adapters/sandbox/enums.js';
import {
  type GoJudgeCommand,
  type GoJudgeResult,
  SandboxClient,
  type SandboxOutcome,
} from '../../interface-adapters/sandbox/interfaces.js';
import { SandboxPool } from './sandbox-pool.js';

@Injectable()
export class GoJudgeSandboxClient implements SandboxClient {
  private static readonly PRESET = 'processes';
  private static readonly RUN = '/run';
  private static readonly LOGGER = new Logger(GoJudgeSandboxClient.name);

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly pool: SandboxPool,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(GoJudgeSandboxClient.PRESET);
  }

  async run(command: GoJudgeCommand): Promise<SandboxOutcome> {
    try {
      return await this.policy.execute(({ signal }) =>
        this.#run(command, signal),
      );
    } catch (error) {
      return GoJudgeSandboxClient.failureOf(error);
    }
  }

  async #run(
    command: GoJudgeCommand,
    signal: AbortSignal,
  ): Promise<SandboxOutcome> {
    const body = JSON.stringify({ cmd: [command] });
    const response = await this.pool.request({
      path: GoJudgeSandboxClient.RUN,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal,
    });
    const text = await response.body.text();
    const result = GoJudgeSandboxClient.resultOf(text);

    if (response.statusCode >= 300 || result === null) {
      GoJudgeSandboxClient.LOGGER.warn(
        `The sandbox refused a run with status ${String(response.statusCode)}`,
      );
      return { kind: SandboxOutcomeKind.Refused };
    }

    return { kind: SandboxOutcomeKind.Ran, result };
  }

  private static resultOf(text: string): GoJudgeResult | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
    const answered =
      typeof first === 'object' &&
      first !== null &&
      typeof Reflect.get(first, 'status') === 'string';

    if (!answered) return null;

    return first as GoJudgeResult;
  }

  private static failureOf(error: unknown): SandboxOutcome {
    if (error instanceof BulkheadFullError)
      return { kind: SandboxOutcomeKind.Rejected };

    if (error instanceof ResilienceTimeoutError)
      return { kind: SandboxOutcomeKind.TimedOut };

    const transport =
      error instanceof Error && typeof Reflect.get(error, 'code') === 'string';

    if (transport) {
      GoJudgeSandboxClient.LOGGER.warn(
        `The sandbox could not be reached: ${error.message}`,
      );
      return { kind: SandboxOutcomeKind.Unreachable };
    }

    throw error;
  }
}
