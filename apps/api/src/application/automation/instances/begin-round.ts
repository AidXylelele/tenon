import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RoundContext } from '../../../domain/automation/instances/round-context.js';
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
    const context = new RoundContext({
      definition,
      runtime: command.runtime,
      now: command.now,
    });
    instance.beginRound(context);
    await this.instances.save(instance);
    return { context, instance };
  }
}
