import type { WorkflowTarget } from '../language/workflow-target.js';
import type { RunnableVersionProps } from './interfaces.js';
import type { Workflow } from './workflow.js';
import type { WorkflowVersion } from './workflow-version.js';

// A published version together with its workflow: what a new instance runs.
export class RunnableVersion {
  readonly #workflow: Workflow;
  readonly #version: WorkflowVersion;

  constructor(props: RunnableVersionProps) {
    if (props.version.workflowId !== props.workflow.id)
      throw new TypeError('The version belongs to another workflow');

    this.#workflow = props.workflow;
    this.#version = props.version;
  }

  // None while the workflow or its version is not found.
  static found(
    workflow: Workflow | null,
    version: WorkflowVersion | null,
  ): RunnableVersion | null {
    if (workflow === null || version === null) return null;

    return new RunnableVersion({ workflow, version });
  }

  get workflow(): Workflow {
    return this.#workflow;
  }

  get version(): WorkflowVersion {
    return this.#version;
  }

  isNamedBy(target: WorkflowTarget): boolean {
    return target.workflow.equals(this.#workflow.name);
  }
}
