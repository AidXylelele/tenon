import type { JsonValue } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { SwitchTask } from '../tasks/switch-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class SwitchProgress extends KindProgress {
  readonly #input: JsonValue;

  constructor(input: JsonValue) {
    super();
    this.#input = input;
  }

  static enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    const progress = new SwitchProgress(input);
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  work(scope: TaskScope<SwitchTask>): RoundWork {
    const args = scope.definitionArguments(this.#input);
    const evaluations = scope.task.evaluationsFor(
      scope.prefix,
      this.#input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: TaskScope<SwitchTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const outcome = scope.task.outcomeFor(this.#input, scope.prefix, results);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
