import { Injectable } from '@nestjs/common';
import { InstanceRuns } from '../../../application/automation/instances/ports.js';
import { type InstanceRun, RunClient } from './interfaces.js';

@Injectable()
export class InstanceRunsGateway implements InstanceRuns {
  constructor(private readonly client: RunClient) {}

  async start(instanceId: string): Promise<void> {
    const run: InstanceRun = { id: instanceId, input: { instanceId } };
    await this.client.start(run);
  }
}
