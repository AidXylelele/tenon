import { Outcome } from '../outcome.js';
import { Phase } from '../phase.js';
import type { WorkflowError } from '../workflow-error.js';
import { TaskEnding } from './task-ending.js';

export class FaultedEnding extends TaskEnding {
  readonly output = null;
  readonly directive = null;
  readonly body = null;
  readonly #failure: WorkflowError;

  constructor(failure: WorkflowError) {
    super();
    this.#failure = failure;
  }

  get failure(): WorkflowError {
    return this.#failure;
  }

  phase(): Phase {
    return Phase.Faulted;
  }

  outcome(): Outcome {
    return Outcome.failed(this.#failure);
  }
}
