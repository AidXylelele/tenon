import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowRow } from '../interfaces.js';

export class WorkflowMapper {
  static toRow(workflow: Workflow): WorkflowRow {
    return {
      id: workflow.id,
      namespace: workflow.name.namespace,
      name: workflow.name.name,
      isOn: workflow.isOn,
      currentVersionId: workflow.currentVersionId,
      version: workflow.version,
    };
  }

  static toEntity(row: WorkflowRow): Workflow {
    const name = new WorkflowName(row.namespace, row.name);
    return new Workflow({
      id: row.id,
      name,
      isOn: row.isOn,
      currentVersionId: row.currentVersionId,
      version: row.version,
    });
  }
}
