import { Injectable } from '@nestjs/common';
import { RoundResults } from '../../../domain/automation/language/round-results.js';
import { RoundWork } from '../../../domain/automation/language/round-work.js';
import { WorkDeferredError } from '../../errors.js';
import { ProcessRunner, type RunDetachedProcessCommand } from './ports.js';

@Injectable()
export class RunDetachedProcess {
  constructor(private readonly processes: ProcessRunner) {}

  async execute(command: RunDetachedProcessCommand): Promise<void> {
    const work = RoundWork.running(command.run);
    const process = await this.processes.run(command.run);
    const results = RoundResults.exited(process);
    const deferred = results.deferredIn(work);

    if (deferred > 0) throw new WorkDeferredError();
  }
}
