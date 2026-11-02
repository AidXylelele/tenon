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

    for (const answer of command.recorded)
      instance.record(
        answer.results,
        command.definition,
        command.runtime,
        answer.at,
      );

    await this.instances.save(instance);
    return instance.progress(command.now);
  }
}
