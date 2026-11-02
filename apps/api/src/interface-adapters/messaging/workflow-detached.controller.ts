import { Injectable } from '@nestjs/common';
import { StartDetachedWorkflow } from '../../application/automation/instances/start-detached-workflow.js';
import { WorkflowName } from '../../domain/automation/language/workflow-name.js';
import { VersionReference } from '../../domain/automation/workflows/version-reference.js';
import type { WorkflowDetachedPayload } from '../interfaces.js';

@Injectable()
export class WorkflowDetachedController {
  constructor(private readonly startDetachedWorkflow: StartDetachedWorkflow) {}

  async handle(payload: WorkflowDetachedPayload): Promise<void> {
    const stored = payload.detached;
    const workflow = new WorkflowName(stored.namespace, stored.name);
    const version = VersionReference.byId(stored.versionId);
    await this.startDetachedWorkflow.execute({
      parentId: payload.instanceId,
      taskInstanceId: payload.taskInstanceId,
      subWorkflowId: payload.subWorkflowId,
      workflow,
      version,
      input: stored.input,
    });
  }
}
