import { Definition } from '../../../domain/automation/language/definition.js';
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
      definition: version.definition.document,
      publisherId: version.publisherId,
      publishedAt: version.publishedAt,
    };
  }

  static toEntity(row: WorkflowVersionRow): WorkflowVersion {
    const source = new SourceDocument({
      format: row.sourceFormat,
      text: row.sourceText,
      fingerprint: row.fingerprint,
    });
    const definition = Definition.restore(row.definition);
    return new WorkflowVersion({
      id: row.id,
      workflowId: row.workflowId,
      semver: row.semver,
      source,
      definition,
      publisherId: row.publisherId,
      publishedAt: row.publishedAt,
    });
  }
}
