import type { SubWorkflowAnswer } from '../answers/sub-workflow-answer.js';
import type { JsonValue, SubWorkflowRequest } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class RunWorkflowProgress extends KindProgress {
  readonly #request: SubWorkflowRequest | null;

  constructor(request: SubWorkflowRequest | null) {
    super();
    this.#request = request;
  }

  static enter(scope: BodyScope<RunWorkflowTask>): Step<KindProgress> {
    const progress = new RunWorkflowProgress(null);
    return progress.settled(scope);
  }

  override subWorkflow(): SubWorkflowRequest | null {
    return this.#request;
  }

  work(scope: BodyScope<RunWorkflowTask>): RoundWork {
    const template = scope.task.input;

    if (this.#request !== null || template === null) return RoundWork.none();

    const args = scope.definitionArguments();
    const evaluations = template.evaluationsFor(
      scope.prefix,
      scope.input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: BodyScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (this.#request !== null || !answered) return Step.of<KindProgress>(this);

    const template = scope.task.input;
    const at = scope.task.reference;
    const failure = template?.failureIn(scope.prefix, results, at) ?? null;

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const input = RunWorkflowProgress.#subWorkflowInput(results, scope);
    const request: SubWorkflowRequest = {
      target: scope.task.target,
      input,
      awaited: scope.task.awaits,
    };
    const requesting = new RunWorkflowProgress(request);
    return Step.of<KindProgress>(requesting);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: BodyScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    if (this.#request === null) return Step.of<KindProgress>(this);

    const outcome = answer.outcomeFor(this.#request, scope);

    if (outcome === null) return Step.of<KindProgress>(this);

    return ConcludedProgress.step(outcome);
  }

  static #subWorkflowInput(
    results: RoundResults,
    scope: BodyScope<RunWorkflowTask>,
  ): JsonValue {
    const template = scope.task.input;

    if (template === null) return scope.input;

    return template.fill(scope.prefix, results);
  }
}
