import type {
  ConformanceStatement,
  PublishedVersionResult,
} from '../../../application/automation/workflows/ports.js';
import type {
  VersionSummary,
  WorkflowPage,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import { DocumentFormat } from '../../../domain/automation/workflows/enums.js';
import { DocumentMediaType } from '../enums.js';
import type {
  ConformanceResponse,
  VersionResponse,
  WorkflowPageResponse,
  WorkflowResponse,
} from '../schemas/workflow.schemas.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';

export class WorkflowPresenter {
  static published(result: PublishedVersionResult): VersionResponse {
    const version = result.version;
    const workflow = result.workflow;
    return {
      namespace: workflow.name.namespace,
      name: workflow.name.name,
      version: version.semver,
      dsl: version.dslVersion,
      current: result.current,
      publishedBy: version.publisherId,
      publishedAt: version.publishedAt.toISOString(),
    };
  }

  static version(version: VersionSummary): VersionResponse {
    return {
      namespace: version.namespace,
      name: version.name,
      version: version.version,
      dsl: version.dsl,
      current: version.current,
      publishedBy: version.publishedBy,
      publishedAt: version.publishedAt.toISOString(),
    };
  }

  static workflow(workflow: WorkflowSummary): WorkflowResponse {
    return {
      namespace: workflow.namespace,
      name: workflow.name,
      on: workflow.isOn,
      currentVersion: workflow.currentVersion,
    };
  }

  static page(page: WorkflowPage): WorkflowPageResponse {
    const items = page.items.map((workflow) =>
      WorkflowPresenter.workflow(workflow),
    );
    const next = CursorMapper.fromWorkflowPosition(page.next);
    return { items, next };
  }

  static conformance(statement: ConformanceStatement): ConformanceResponse {
    return {
      dsl: statement.dsl.slice(),
      tasks: statement.tasks.slice(),
      calls: statement.calls.slice(),
      runs: statement.runs.slice(),
      scriptLanguages: statement.scriptLanguages.slice(),
      authentications: statement.authentications.slice(),
      excluded: statement.excluded.slice(),
      contradictions: statement.contradictions.slice(),
    };
  }

  static mediaType(format: DocumentFormat): DocumentMediaType {
    if (format === DocumentFormat.Json) return DocumentMediaType.Json;

    return DocumentMediaType.Yaml;
  }
}
