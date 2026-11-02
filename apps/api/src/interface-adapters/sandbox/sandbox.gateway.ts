import { Injectable } from '@nestjs/common';
import { ProcessRunner } from '../../application/automation/instances/ports.js';
import { Clock } from '../../application/automation/language/ports.js';
import type { ProcessRun } from '../../domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../domain/automation/language/results/process-result.js';
import { ProcessTimedOut } from '../../domain/automation/language/results/process-timed-out.js';
import { SandboxClient, SandboxLimits } from './interfaces.js';
import { ProcessRunMapper } from './mappers/process-run.mapper.js';

@Injectable()
export class SandboxGateway implements ProcessRunner {
  constructor(
    private readonly client: SandboxClient,
    private readonly limits: SandboxLimits,
    private readonly clock: Clock,
  ) {}

  async runAll(runs: readonly ProcessRun[]): Promise<readonly ProcessResult[]> {
    const settled = await Promise.all(runs.map((run) => this.#run(run)));
    return settled.filter((result) => result !== null);
  }

  async #run(run: ProcessRun): Promise<ProcessResult | null> {
    const timeout = this.#timeoutOf(run);

    if (timeout !== null && timeout <= 0) return new ProcessTimedOut(run.id);

    const command = ProcessRunMapper.toCommand(run, this.limits, timeout);
    const outcome = await this.client.run(command);
    const left = this.#timeoutOf(run);

    // An answer that arrives after the task's deadline is a time-out.
    if (left !== null && left < 0) return new ProcessTimedOut(run.id);

    return ProcessRunMapper.toResult(run.id, outcome);
  }

  #timeoutOf(run: ProcessRun): number | null {
    if (run.deadline === null) return null;

    const now = this.clock.now();
    return run.deadline.getTime() - now.getTime();
  }
}
