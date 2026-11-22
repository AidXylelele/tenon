import { Injectable } from "@nestjs/common";
import type { VersionPublication } from "../../../domain/automation/workflows/interfaces.js";
import { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import type { VersionCatalogueRow, WorkflowVersionRow } from "../interfaces.js";

@Injectable()
export class WorkflowVersionMapper {
  toRow(
    workflowId: string,
    publication: VersionPublication,
  ): WorkflowVersionRow {
    const version = publication.version;
    return {
      id: version.id,
      workflowId,
      semver: version.semver,
      dsl: version.dsl,
      document: publication.document,
      imports: publication.imports,
      digest: version.digest,
      programFingerprint: version.programFingerprint,
      schedule: version.schedule,
      secrets: version.secrets.slice(),
      source: publication.source,
      publisherId: version.publisherId,
      publishedAt: version.publishedAt,
    };
  }

  toEntity(row: VersionCatalogueRow): WorkflowVersion {
    return new WorkflowVersion({
      id: row.id,
      semver: row.semver,
      dsl: row.dsl,
      digest: row.digest,
      programFingerprint: row.programFingerprint,
      schedule: row.schedule,
      secrets: row.secrets,
      publisherId: row.publisherId,
      publishedAt: row.publishedAt,
    });
  }
}
