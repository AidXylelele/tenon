import type { SubWorkflowRequest } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';

export abstract class SubWorkflowAnswer {
  abstract outcomeFor(
    request: SubWorkflowRequest,
    scope: BodyScope<RunWorkflowTask>,
  ): Outcome | null;
}
