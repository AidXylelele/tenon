import { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { WorkflowInstanceRow } from '../interfaces.js';

export class WorkflowInstanceMapper {
  static toRow(instance: WorkflowInstance): WorkflowInstanceRow {
    return {
      id: instance.id,
      workflowId: instance.workflowId,
      versionId: instance.versionId,
      trigger: instance.trigger,
      starterId: instance.starterId,
      originId: instance.originId,
      input: instance.input,
      phase: instance.phase,
      output: instance.output,
      error: instance.error,
      createdAt: instance.createdAt,
      startedAt: instance.startedAt,
      endedAt: instance.endedAt,
      version: instance.version,
    };
  }

  static toEntity(row: WorkflowInstanceRow): WorkflowInstance {
    return new WorkflowInstance({
      id: row.id,
      workflowId: row.workflowId,
      versionId: row.versionId,
      trigger: row.trigger,
      starterId: row.starterId,
      originId: row.originId,
      input: row.input ?? null,
      phase: row.phase,
      output: row.output,
      error: row.error,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      version: row.version,
    });
  }
}
