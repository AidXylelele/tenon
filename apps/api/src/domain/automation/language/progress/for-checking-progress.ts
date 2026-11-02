import { InconsistentProgressError } from '../../../errors.js';
import type { ForIteration } from '../for-iteration.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { ForTask } from '../tasks/for-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { ForIteratingProgress } from './for-iterating-progress.js';
import { KindProgress } from './kind-progress.js';
import type { WorkKey } from '../work-key.js';

// A `for` with `while`, before an item: the condition, evaluated on the data so far, decides
// whether the item runs or the loop ends.
export class ForCheckingProgress extends KindProgress {
  static readonly #WHILE = 'while';

  readonly #iteration: ForIteration;

  constructor(iteration: ForIteration) {
    super();

    if (iteration.isOver())
      throw new InconsistentProgressError(
        'a for checks its condition only before an item',
      );

    this.#iteration = iteration;
  }

  get iteration(): ForIteration {
    return this.#iteration;
  }

  work(scope: BodyScope<ForTask>): RoundWork {
    const task = scope.task;
    const additions = task.variablesFor(this.#iteration);
    const args = scope.definitionArgumentsWith(additions);
    const key = this.#key(scope);
    const data = this.#iteration.data;
    const evaluations = task.whilst.evaluationsFor(key, data, args);
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: BodyScope<ForTask>): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const whilst = scope.task.whilst;
    const key = this.#key(scope);
    const at = scope.task.reference;
    const failure = whilst.failureIn(key, results, at);

    if (failure !== null) return ConcludedProgress.failed(failure);

    const continues = whilst.holds(key, results);

    if (continues) return ForIteratingProgress.start(this.#iteration, scope);

    const completed = Outcome.of(this.#iteration.data);
    return ConcludedProgress.step(completed);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  #key(scope: BodyScope): WorkKey {
    const index = this.#iteration.index;
    return scope.key.within(ForCheckingProgress.#WHILE, index);
  }
}
