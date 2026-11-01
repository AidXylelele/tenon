import { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import type { WorkflowVersionRow } from '../interfaces.js';

export class WorkflowVersionMapper {
  static toRow(version: WorkflowVersion): WorkflowVersionRow {
    return {
      id: version.id,
      workflowId: version.workflowId,
      semver: version.semver,
      dslVersion: version.dslVersion,
      sourceFormat: version.source.format,
      sourceText: version.source.text,
      fingerprint: version.source.fingerprint,
      publisherId: version.publisherId,
      publishedAt: version.publishedAt,
    };
  }

  static toEntity(row: WorkflowVersionRow): WorkflowVersion {
    const source = new SourceDocument({
      format: row.sourceFormat,
      text: row.sourceText,
    });
    return new WorkflowVersion({
      id: row.id,
      workflowId: row.workflowId,
      semver: row.semver,
      dslVersion: row.dslVersion,
      source,
      publisherId: row.publisherId,
      publishedAt: row.publishedAt,
    });
  }
}
