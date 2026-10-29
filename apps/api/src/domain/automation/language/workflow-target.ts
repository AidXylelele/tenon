import type { WorkflowName } from './workflow-name.js';

export class WorkflowTarget {
  static readonly LATEST = 'latest';

  readonly #workflow: WorkflowName;
  readonly #version: string;

  constructor(workflow: WorkflowName, version: string) {
    this.#workflow = workflow;
    this.#version = version;
  }

  get workflow(): WorkflowName {
    return this.#workflow;
  }

  get version(): string {
    return this.#version;
  }

  isLatest(): boolean {
    return this.#version === WorkflowTarget.LATEST;
  }

  equals(other: WorkflowTarget): boolean {
    const sameWorkflow = this.#workflow.equals(other.#workflow);
    return sameWorkflow && this.#version === other.#version;
  }
}
