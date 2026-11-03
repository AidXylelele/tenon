import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import {
  type InstanceCommand,
  type InstanceResult,
  WorkflowInstanceRepository,
} from './ports.js';

// An ended instance's history goes; the engine forgets its run after the commit.
@Injectable()
export class DeleteInstance {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<InstanceResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const deleted = instance.delete();

    if (!deleted.ok) return deleted;

    await this.instances.remove(instance);
    return deleted;
  }
}
