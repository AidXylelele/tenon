import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ReadVersionDefinition } from '../workflows/read-version-definition.js';
import {
  type BeginRoundCommand,
  type BegunRoundResult,
  WorkflowInstanceRepository,
} from './ports.js';

@Injectable()
export class BeginRound {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly readDefinition: ReadVersionDefinition,
  ) {}

  @Transactional()
  async execute(command: BeginRoundCommand): Promise<BegunRoundResult> {
    const instance = await this.instances.get(command.instanceId);

    const definition = await this.readDefinition.execute(instance.versionId);
    instance.beginRound(definition, command.runtime, command.now);
    await this.instances.save(instance);
    return { definition, instance };
  }
}
