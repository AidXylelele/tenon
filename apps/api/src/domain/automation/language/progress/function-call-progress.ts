import { TaskKind } from '../enums.js';
import type { JsonValue, TaskStart } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { FunctionCallTask } from '../tasks/function-call-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class FunctionCallProgress extends KindProgress {
  readonly #started: boolean;

  constructor(started: boolean) {
    super();
    this.#started = started;
  }

  static enter(scope: BodyScope<FunctionCallTask>): Step<KindProgress> {
    const progress = new FunctionCallProgress(false);
    return progress.settled(scope);
  }

  get started(): boolean {
    return this.#started;
  }

  work(scope: BodyScope<FunctionCallTask>): RoundWork {
    const args = scope.task.arguments;

    if (this.#started || args === null) return RoundWork.none();

    const definitionArguments = scope.definitionArguments();
    const evaluations = args.evaluationsFor(
      scope.prefix,
      scope.input,
      definitionArguments,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: BodyScope<FunctionCallTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (this.#started || !answered) return Step.of<KindProgress>(this);

    const args = scope.task.arguments;

    if (args === null) return FunctionCallProgress.#start(scope.input, scope);

    const at = scope.task.reference;
    const failure = args.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const input = args.fill(scope.prefix, results);
    return FunctionCallProgress.#start(input, scope);
  }

  childEnded(child: JsonPointer, ending: TaskEnding): Step<KindProgress> {
    if (!this.#started) return Step.of<KindProgress>(this);

    const workflowEnd = ending.workflowEnd();

    if (workflowEnd !== null) return ConcludedProgress.step(workflowEnd);

    const outcome = ending.outcome();
    return ConcludedProgress.step(outcome);
  }

  static #start(
    input: JsonValue,
    scope: BodyScope<FunctionCallTask>,
  ): Step<KindProgress> {
    const callAt = scope.task.reference.at(TaskKind.Call);
    const declared = scope.definition.components.function(
      scope.task.function,
      callAt,
    );
    const start: TaskStart = {
      reference: declared.reference,
      input,
      variables: scope.variables,
    };
    const started = new FunctionCallProgress(true);
    return new Step<KindProgress>(started, [start]);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
