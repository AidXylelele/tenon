import type { PublishedVersionResult } from '../../../application/automation/workflows/ports.js';
import type {
  VersionSummary,
  WorkflowPage,
  WorkflowSummary,
} from '../../../application/automation/workflows/queries.js';
import type { ConformanceStatement } from '../../../domain/automation/language/interfaces.js';
import type { Problem } from '../../../domain/automation/language/problem.js';
import type { Report } from '../../../domain/automation/language/report.js';
import type {
  CheckReportResponse,
  ConformanceResponse,
  ProblemResponse,
  VersionResponse,
  WorkflowPageResponse,
  WorkflowResponse,
} from '../schemas/workflow.schemas.js';

export class WorkflowPresenter {
  static report(report: Report): CheckReportResponse {
    const problems = WorkflowPresenter.problems(report.problems);
    return { valid: report.isClean(), problems };
  }

  static problems(problems: readonly Problem[]): ProblemResponse[] {
    return problems.map((problem) => ({
      pointer: problem.pointer,
      message: problem.reason,
    }));
  }

  static published(result: PublishedVersionResult): VersionResponse {
    const version = result.version;
    const workflow = version.definition.workflow;
    return {
      namespace: workflow.namespace,
      name: workflow.name,
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
    return { items, next: page.next };
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
}
