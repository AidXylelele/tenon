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

  async run(run: ProcessRun): Promise<ProcessResult | null> {
    const timeout = this.clock.remainingUntil(run.deadline);

    // A deadline that passed before the process starts is a time-out; the sandbox stops one
    // that outlives it, and the instance judges the answer's time.
    if (timeout !== null && timeout <= 0) return new ProcessTimedOut(run.id);

    const command = ProcessRunMapper.toCommand(run, this.limits, timeout);
    const outcome = await this.client.run(command);
    return ProcessRunMapper.toResult(run.id, outcome);
  }
}
