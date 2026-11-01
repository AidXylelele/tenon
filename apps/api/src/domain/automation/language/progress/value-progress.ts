import type { JsonValue, ValueTask } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ValueProgress extends KindProgress {
  readonly #input: JsonValue;

  constructor(input: JsonValue) {
    super();
    this.#input = input;
  }

  static enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    const progress = new ValueProgress(input);
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  work(scope: TaskScope<ValueTask>): RoundWork {
    const args = scope.definitionArguments(this.#input);
    const template = scope.task.template;
    const evaluations = template.evaluationsFor(
      scope.prefix,
      this.#input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: TaskScope<ValueTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const template = scope.task.template;
    const at = scope.task.reference;
    const failure = template.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const value = template.fill(scope.prefix, results);
    const outcome = scope.task.outcomeOf(value, scope);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
