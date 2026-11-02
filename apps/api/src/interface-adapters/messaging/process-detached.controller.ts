import { Injectable } from '@nestjs/common';
import { RunDetachedProcess } from '../../application/automation/instances/run-detached-process.js';
import type { ProcessRun } from '../../domain/automation/language/interfaces.js';
import type { ProcessDetachedPayload } from '../interfaces.js';

@Injectable()
export class ProcessDetachedController {
  constructor(private readonly runDetachedProcess: RunDetachedProcess) {}

  async handle(payload: ProcessDetachedPayload): Promise<void> {
    const stored = payload.run;
    const run: ProcessRun = {
      id: stored.id,
      kind: stored.kind,
      language: stored.language,
      process: stored.process,
    };
    await this.runDetachedProcess.execute({ run });
  }
}
