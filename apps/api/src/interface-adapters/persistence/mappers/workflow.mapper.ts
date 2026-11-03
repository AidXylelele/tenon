import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { WorkflowRow } from '../interfaces.js';

export class WorkflowMapper {
  static toRow(workflow: Workflow): WorkflowRow {
    return {
      id: workflow.id,
      namespace: workflow.name.namespace,
      name: workflow.name.name,
      status: workflow.status,
      currentVersionId: workflow.currentVersionId,
      archivedAt: workflow.archivedAt,
      version: workflow.version,
    };
  }

  static toEntity(row: WorkflowRow): Workflow {
    const name = new WorkflowName(row.namespace, row.name);
    return new Workflow({
      id: row.id,
      name,
      status: row.status,
      currentVersionId: row.currentVersionId,
      archivedAt: row.archivedAt,
      version: row.version,
    });
  }
}
