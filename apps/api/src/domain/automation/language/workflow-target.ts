import type { WorkflowName } from './workflow-name.js';

export class WorkflowTarget {
  static readonly #LATEST = 'latest';

  readonly #workflow: WorkflowName;
  readonly #version: string;

  constructor(workflow: WorkflowName, version: string) {
    this.#workflow = workflow;
    this.#version = version;
  }

  static of(workflow: WorkflowName, version: string | null): WorkflowTarget {
    const named = version ?? WorkflowTarget.#LATEST;
    return new WorkflowTarget(workflow, named);
  }

  get workflow(): WorkflowName {
    return this.#workflow;
  }

  get version(): string {
    return this.#version;
  }

  isLatest(): boolean {
    return this.#version === WorkflowTarget.#LATEST;
  }
}
