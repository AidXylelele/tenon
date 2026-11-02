import type { DetachedWorkflow, SubWorkflowRequest } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { SubWorkflowAnswer } from './sub-workflow-answer.js';

export class SubWorkflowDetached extends SubWorkflowAnswer {
  readonly #detached: DetachedWorkflow;

  constructor(detached: DetachedWorkflow) {
    super();
    this.#detached = detached;
  }

  outcomeFor(
    request: SubWorkflowRequest,
    scope: BodyScope<RunWorkflowTask>,
  ): Outcome | null {
    if (request.awaited) return null;

    return Outcome.detachingWorkflow(scope.input, this.#detached);
  }
}
