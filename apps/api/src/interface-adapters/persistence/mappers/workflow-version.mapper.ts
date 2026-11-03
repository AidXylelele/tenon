import { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import type { WorkflowVersionRow } from '../interfaces.js';

export class WorkflowVersionMapper {
  static toRow(version: WorkflowVersion): WorkflowVersionRow {
    return {
      id: version.id,
      workflowId: version.workflowId,
      semver: version.semver,
      dsl: version.dsl,
      document: version.document,
      fingerprint: version.fingerprint,
      publisherId: version.publisherId,
      publishedAt: version.publishedAt,
    };
  }

  static toEntity(row: WorkflowVersionRow): WorkflowVersion {
    return new WorkflowVersion({
      id: row.id,
      workflowId: row.workflowId,
      semver: row.semver,
      dsl: row.dsl,
      document: row.document,
      fingerprint: row.fingerprint,
      publisherId: row.publisherId,
      publishedAt: row.publishedAt,
    });
  }
}
