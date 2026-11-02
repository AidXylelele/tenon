import { Injectable, Logger } from '@nestjs/common';
import {
  BulkheadFullError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { errors } from 'undici';
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
  // The statuses with which go-judge refuses this command, its message in a JSON string. Its 500
  // is its own failure (a worker shutting down, a full queue), an outage like any other.
  private static readonly REFUSING: readonly number[] = [400, 404];
  // The connection failures: anything else is a defect, not an outage.
  private static readonly UNREACHABLE: readonly string[] = [
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CLOSED',
    'UND_ERR_DESTROYED',
  ];

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
    const refusal = GoJudgeSandboxClient.refusalOf(response.statusCode, text);

    if (refusal !== null) {
      GoJudgeSandboxClient.LOGGER.warn(`The sandbox refused a run: ${refusal}`);
      return { kind: SandboxOutcomeKind.Failed };
    }

    const result = GoJudgeSandboxClient.resultOf(text);

    if (response.statusCode >= 300 || result === null) {
      GoJudgeSandboxClient.LOGGER.warn(
        `The sandbox answered other than with a result, status ${String(response.statusCode)}`,
      );
      return { kind: SandboxOutcomeKind.Unrecognized };
    }

    return { kind: SandboxOutcomeKind.Ran, result };
  }

  private static refusalOf(status: number, text: string): string | null {
    if (!GoJudgeSandboxClient.REFUSING.includes(status)) return null;

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    if (typeof parsed !== 'string') return null;

    return parsed;
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

    if (error instanceof ResilienceTimeoutError) {
      GoJudgeSandboxClient.LOGGER.warn('The sandbox did not answer in time');
      return { kind: SandboxOutcomeKind.TimedOut };
    }

    if (error instanceof errors.ResponseExceededMaxSizeError) {
      GoJudgeSandboxClient.LOGGER.warn('The sandbox answered beyond its bound');
      return { kind: SandboxOutcomeKind.Oversized };
    }

    const code: unknown =
      error instanceof Error ? Reflect.get(error, 'code') : undefined;
    const transport =
      typeof code === 'string' &&
      GoJudgeSandboxClient.UNREACHABLE.includes(code);

    if (transport && error instanceof Error) {
      GoJudgeSandboxClient.LOGGER.warn(
        `The sandbox could not be reached: ${error.message}`,
      );
      return { kind: SandboxOutcomeKind.Unreachable };
    }

    throw error;
  }
}
