import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowRow } from '../interfaces.js';

export class WorkflowMapper {
  static toRow(workflow: Workflow): WorkflowRow {
    return {
      id: workflow.id,
      namespace: workflow.namespace,
      name: workflow.name,
      isOn: workflow.isOn,
      currentVersionId: workflow.currentVersionId,
      version: workflow.version,
    };
  }

  static toEntity(row: WorkflowRow): Workflow {
    return new Workflow({
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      isOn: row.isOn,
      currentVersionId: row.currentVersionId,
      version: row.version,
    });
  }
}
