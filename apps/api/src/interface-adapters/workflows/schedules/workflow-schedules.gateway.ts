import { Injectable } from '@nestjs/common';
import type { WorkflowSchedules } from '../../../application/automation/schedules/ports.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import { ScheduleClient } from '../interfaces.js';

@Injectable()
export class WorkflowSchedulesGateway implements WorkflowSchedules {
  constructor(private readonly client: ScheduleClient) {}

  apply(workflow: Workflow, version: WorkflowVersion): Promise<void> {
    return this.client.apply(workflow.id, workflow.version, version.document);
  }

  clear(workflow: Workflow): Promise<void> {
    return this.client.clear(workflow.id);
  }

  continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void> {
    return this.client.continueAfter(
      instance.workflowId,
      instance.id,
      version.document,
    );
  }
}
