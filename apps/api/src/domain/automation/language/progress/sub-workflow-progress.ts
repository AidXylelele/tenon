import type { SubWorkflowAnswer } from '../answers/sub-workflow-answer.js';
import type { SubWorkflowRequest } from '../interfaces.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

// Stage 3 of `run: workflow`: the sub-workflow is requested, and its answer decides.
export class SubWorkflowProgress extends KindProgress {
  readonly #request: SubWorkflowRequest;

  constructor(request: SubWorkflowRequest) {
    super();
    this.#request = request;
  }

  get request(): SubWorkflowRequest {
    return this.#request;
  }

  override subWorkflow(): SubWorkflowRequest {
    return this.#request;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: BodyScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    const outcome = answer.outcomeFor(this.#request, scope);

    if (outcome === null) return Step.of<KindProgress>(this);

    return ConcludedProgress.step(outcome);
  }
}
