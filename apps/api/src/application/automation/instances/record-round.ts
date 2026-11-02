import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { InstanceProgress } from '../../../domain/automation/instances/interfaces.js';
import {
  type RecordRoundCommand,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class RecordRound {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  @Transactional()
  async execute(command: RecordRoundCommand): Promise<InstanceProgress> {
    const instance = await this.instances.get(command.instanceId);

    instance.recordRound(command.round, command.recorded, command.context);

    await this.instances.save(instance);
    return instance.progress(command.context.now);
  }
}
