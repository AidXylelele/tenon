import { Injectable } from '@nestjs/common';
import {
  BulkheadFullError,
  ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { ProcessRunner } from '../../application/automation/instances/ports.js';
import type { ProcessRun } from '../../domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../domain/automation/language/results/process-result.js';
import { ProcessTimedOut } from '../../domain/automation/language/results/process-timed-out.js';
import { SandboxFailed } from '../../domain/automation/language/results/sandbox-failed.js';
import {
  type GoJudgeResult,
  SandboxLimits,
  SandboxPool,
} from './interfaces.js';
import { ProcessRunMapper } from './mappers/process-run.mapper.js';

@Injectable()
export class GoJudgeProcessRunner implements ProcessRunner {
  private static readonly PRESET = 'processes';
  private static readonly RUN = '/run';
  private static readonly UNREACHABLE = 'The sandbox could not be reached';
  private static readonly REFUSED = 'The sandbox refused to run the process';

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly pool: SandboxPool,
    private readonly limits: SandboxLimits,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(GoJudgeProcessRunner.PRESET);
  }

  async runAll(runs: readonly ProcessRun[]): Promise<readonly ProcessResult[]> {
    const settled = await Promise.all(runs.map((run) => this.#run(run)));
    return settled.filter((result) => result !== null);
  }

  async #run(run: ProcessRun): Promise<ProcessResult | null> {
    try {
      return await this.policy.execute(({ signal }) =>
        this.#execute(run, signal),
      );
    } catch (error) {
      return this.#resultOf(run, error);
    }
  }

  #resultOf(run: ProcessRun, error: unknown): ProcessResult | null {
    if (error instanceof BulkheadFullError) return null;

    if (error instanceof ResilienceTimeoutError)
      return new ProcessTimedOut(run.id);

    const transport =
      error instanceof Error && typeof Reflect.get(error, 'code') === 'string';

    if (transport)
      return new SandboxFailed(run.id, GoJudgeProcessRunner.UNREACHABLE);

    throw error;
  }

  async #execute(run: ProcessRun, signal: AbortSignal): Promise<ProcessResult> {
    const command = ProcessRunMapper.toCommand(run, this.limits);
    const body = JSON.stringify({ cmd: [command] });
    const response = await this.pool.request({
      path: GoJudgeProcessRunner.RUN,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal,
    });
    const text = await response.body.text();
    const results = JSON.parse(text) as unknown;
    const first: unknown = Array.isArray(results) ? results[0] : undefined;
    const answered = response.statusCode < 300 && typeof first === 'object';

    if (!answered || first === null)
      return new SandboxFailed(run.id, GoJudgeProcessRunner.REFUSED);

    return ProcessRunMapper.toResult(run.id, first as GoJudgeResult);
  }
}
