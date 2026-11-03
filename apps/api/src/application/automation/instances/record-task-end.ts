import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RunDirective } from '../../../domain/automation/instances/enums.js';
import {
  type RecordTaskCommand,
  TaskProgress,
  WorkflowInstanceRepository,
} from './ports.js';

// A task ended: the progress view keeps what it did, and the instance answers what the run does
// next — nothing once it ended, nothing until a resume while it is suspended.
@Injectable()
export class RecordTaskEnd {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly progress: TaskProgress,
  ) {}

  @Transactional()
  async execute(command: RecordTaskCommand): Promise<RunDirective> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return RunDirective.Stop;

    const directive = instance.directive();

    // A result that arrives after the instance ended is discarded (US9).
    if (directive === RunDirective.Stop) return directive;

    await this.progress.ended(command.instanceId, command.task);
    return directive;
  }
}
