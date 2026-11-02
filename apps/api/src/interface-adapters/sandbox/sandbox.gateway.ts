import { Injectable } from '@nestjs/common';
import { ProcessRunner } from '../../application/automation/instances/ports.js';
import type { ProcessRun } from '../../domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../domain/automation/language/results/process-result.js';
import { SandboxClient, SandboxLimits } from './interfaces.js';
import { ProcessRunMapper } from './mappers/process-run.mapper.js';

@Injectable()
export class SandboxGateway implements ProcessRunner {
  constructor(
    private readonly client: SandboxClient,
    private readonly limits: SandboxLimits,
  ) {}

  async runAll(runs: readonly ProcessRun[]): Promise<readonly ProcessResult[]> {
    const settled = await Promise.all(runs.map((run) => this.#run(run)));
    return settled.filter((result) => result !== null);
  }

  async #run(run: ProcessRun): Promise<ProcessResult | null> {
    const command = ProcessRunMapper.toCommand(run, this.limits);
    const outcome = await this.client.run(command);
    return ProcessRunMapper.toResult(run.id, outcome);
  }
}
