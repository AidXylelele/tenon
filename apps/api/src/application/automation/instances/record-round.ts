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

    instance.confirmRound(command.round);

    for (const answer of command.recorded) {
      const arrived = command.context.at(answer.at);
      instance.record(answer.results, arrived);
    }

    await this.instances.save(instance);
    return instance.progress(command.context.now);
  }
}
