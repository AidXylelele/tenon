import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  type InstanceCommand,
  type InstanceResult,
  WorkflowInstanceRepository,
} from './ports.js';

// A user's cancel (US9): the engine learns of it after the commit, through the outbox.
@Injectable()
export class CancelInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<InstanceResult> {
    const now = this.clock.now();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const changed = instance.cancel(now);

    if (!changed.ok) return changed;

    await this.instances.save(instance);
    return changed;
  }
}
