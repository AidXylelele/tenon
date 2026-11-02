import { ErrorType } from '../error-type.js';
import type { SubWorkflowRequest } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { SubWorkflowAnswer } from './sub-workflow-answer.js';

export class SubWorkflowRefused extends SubWorkflowAnswer {
  static readonly #NOT_RUNNABLE =
    'The workflow to run does not exist, or the version it names is not published';

  outcomeFor(
    request: SubWorkflowRequest,
    scope: BodyScope<RunWorkflowTask>,
  ): Outcome {
    const error = ErrorType.Configuration.errorAt(
      scope.task.reference,
      SubWorkflowRefused.#NOT_RUNNABLE,
    );
    return Outcome.failed(error);
  }
}
