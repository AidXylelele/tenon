import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';

import {
  type InstanceCommand,
  type InstanceResult,
  WorkflowInstanceRepository,
} from './ports.js';

// A user's resume (US9): the engine learns of it after the commit, through the outbox.
@Injectable()
export class ResumeInstance {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<InstanceResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const changed = instance.resume();

    if (!changed.ok) return changed;

    await this.instances.save(instance);
    return changed;
  }
}
