import type { WorkflowTarget } from './workflow-target.js';

export class WorkflowReference {
  readonly #pointer: string;
  readonly #target: WorkflowTarget;

  constructor(pointer: string, target: WorkflowTarget) {
    this.#pointer = pointer;
    this.#target = target;
  }

  get pointer(): string {
    return this.#pointer;
  }

  get target(): WorkflowTarget {
    return this.#target;
  }
}
