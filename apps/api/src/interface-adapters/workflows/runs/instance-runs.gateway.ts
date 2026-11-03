import { Injectable } from '@nestjs/common';
import type { InstanceRuns } from '../../../application/automation/instances/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { RunClient } from '../interfaces.js';

@Injectable()
export class InstanceRunsGateway implements InstanceRuns {
  constructor(private readonly client: RunClient) {}

  start(instance: WorkflowInstance): Promise<void> {
    return this.client.start(instance.id);
  }
}
