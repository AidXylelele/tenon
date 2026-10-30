import type { WorkflowName } from './workflow-name.js';

export class WorkflowTarget {
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
}
