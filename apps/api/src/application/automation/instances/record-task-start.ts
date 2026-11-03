import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { type RecordTaskCommand, TaskProgress } from './ports.js';

// A task began: the progress view shows it running.
@Injectable()
export class RecordTaskStart {
  constructor(private readonly progress: TaskProgress) {}

  @Transactional()
  async execute(command: RecordTaskCommand): Promise<void> {
    await this.progress.started(command.instanceId, command.task);
  }
}
