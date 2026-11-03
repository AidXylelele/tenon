import { Injectable } from '@nestjs/common';
import { StartScheduledInstance } from '../../../application/automation/schedules/start-scheduled-instance.js';

// What a schedule's occurrence asks of the platform: one instance, named by the occurrence.
@Injectable()
export class ScheduleRunController {
  constructor(
    private readonly startScheduledInstance: StartScheduledInstance,
  ) {}

  async startScheduled(
    workflowId: string,
    instanceId: string,
    chained: boolean,
  ): Promise<void> {
    await this.startScheduledInstance.execute({
      workflowId,
      instanceId,
      chained,
    });
  }
}
