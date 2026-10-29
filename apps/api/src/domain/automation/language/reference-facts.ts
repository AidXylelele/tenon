import type { PublishedTargets } from './interfaces.js';
import { WorkflowName } from './workflow-name.js';
import { WorkflowTarget } from './workflow-target.js';

export class ReferenceFacts {
  readonly #workflows: readonly WorkflowName[];
  readonly #versions: readonly WorkflowTarget[];

  constructor(
    workflows: readonly WorkflowName[],
    versions: readonly WorkflowTarget[],
  ) {
    this.#workflows = workflows;
    this.#versions = versions;
  }

  static of(published: PublishedTargets): ReferenceFacts {
    const workflows = published.workflows.map(
      (row) => new WorkflowName(row.namespace, row.name),
    );
    const versions = published.versions.map((row) => {
      const workflow = new WorkflowName(row.namespace, row.name);
      return new WorkflowTarget(workflow, row.version);
    });
    return new ReferenceFacts(workflows, versions);
  }

  hasWorkflow(name: WorkflowName): boolean {
    return this.#workflows.some((workflow) => workflow.equals(name));
  }

  hasVersion(target: WorkflowTarget): boolean {
    return this.#versions.some((version) => version.equals(target));
  }
}
