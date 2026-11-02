import { ErrorType } from '../error-type.js';
import type { SubWorkflowEnding, SubWorkflowRequest } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import { Phase } from '../phase.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { SubWorkflowAnswer } from './sub-workflow-answer.js';

export class SubWorkflowEnded extends SubWorkflowAnswer {
  static readonly #NO_RESULT = 'The sub-workflow ended without a result';

  readonly #ending: SubWorkflowEnding | null;

  constructor(ending: SubWorkflowEnding | null) {
    super();
    this.#ending = ending;
  }

  outcomeFor(
    request: SubWorkflowRequest,
    scope: BodyScope<RunWorkflowTask>,
  ): Outcome | null {
    if (!request.awaited) return null;

    const at = scope.task.reference;
    const ending = this.#ending;

    if (ending === null) return SubWorkflowEnded.#unanswered(scope);

    if (ending.phase === Phase.Completed) return Outcome.of(ending.output);

    if (ending.phase !== Phase.Faulted || ending.error === null)
      return SubWorkflowEnded.#unanswered(scope);

    const escalated = ending.error.raisedAt(at);
    return Outcome.failed(escalated);
  }

  static #unanswered(scope: BodyScope<RunWorkflowTask>): Outcome {
    const error = ErrorType.Runtime.errorAt(
      scope.task.reference,
      SubWorkflowEnded.#NO_RESULT,
    );
    return Outcome.failed(error);
  }
}
