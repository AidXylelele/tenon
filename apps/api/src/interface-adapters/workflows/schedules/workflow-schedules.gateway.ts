import { Injectable } from '@nestjs/common';
import type { WorkflowSchedules } from '../../../application/automation/schedules/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import { ScheduleClient, TimingClient } from '../interfaces.js';

// A version's schedule as the engine runs it: the runtime reads its timing from the document.
@Injectable()
export class WorkflowSchedulesGateway implements WorkflowSchedules {
  constructor(
    private readonly client: ScheduleClient,
    private readonly timings: TimingClient,
  ) {}

  apply(workflow: Workflow, version: WorkflowVersion): Promise<void> {
    const timing = this.timings.timingOf(version.document);
    return this.client.apply(workflow.id, workflow.version, timing);
  }

  clear(workflow: Workflow): Promise<void> {
    return this.client.clear(workflow.id);
  }

  continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void> {
    const timing = this.timings.timingOf(version.document);
    return this.client.continueAfter(instance.workflowId, instance.id, timing);
  }
}
