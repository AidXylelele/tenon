import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type RecordTaskCommand,
  TaskProgress,
  WorkflowInstanceRepository,
} from './ports.js';

// A task began: the progress view shows it running, unless the instance has ended (its results
// are discarded, US9) or is gone.
@Injectable()
export class RecordTaskStart {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly progress: TaskProgress,
  ) {}

  @Transactional()
  async execute(command: RecordTaskCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null || instance.ended) return;

    await this.progress.started(command.instanceId, command.task);
  }
}
