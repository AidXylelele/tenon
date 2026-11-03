import { HttpStatus } from '@nestjs/common';
import type { PreparedPublication } from '../../../application/automation/workflows/ports.js';
import type {
  VersionSummary,
  WorkflowPage,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';
import type {
  VersionResponse,
  WorkflowPageResponse,
  WorkflowResponse,
} from '../schemas/workflow.schemas.js';

export class WorkflowPresenter {
  private static readonly PREFIX = '/api/v1/workflows';

  static published(prepared: PreparedPublication): VersionResponse {
    const workflow = prepared.workflow;
    const version = prepared.publication.version;
    const current = workflow.currentVersionId === version.id;
    return {
      namespace: workflow.name.namespace,
      name: workflow.name.name,
      version: version.semver,
      dsl: version.dsl,
      current,
      publishedBy: version.publisherId,
      publishedAt: version.publishedAt.toISOString(),
    };
  }

  // 201 for a version published now, 200 for the same document again (FR-004).
  static statusOf(prepared: PreparedPublication): HttpStatus {
    if (prepared.publication.created) return HttpStatus.CREATED;

    return HttpStatus.OK;
  }

  static locationOf(prepared: PreparedPublication): string {
    const name = prepared.workflow.name;
    const version = prepared.publication.version.semver;
    return `${WorkflowPresenter.PREFIX}/${name.namespace}/${name.name}/versions/${version}`;
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
      status: workflow.status,
      on: workflow.on,
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
}
