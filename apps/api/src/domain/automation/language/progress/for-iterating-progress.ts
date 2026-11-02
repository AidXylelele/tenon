import { InconsistentProgressError } from '../../../errors.js';
import type { TaskEnding } from '../endings/task-ending.js';
import type { ForIteration } from '../for-iteration.js';
import type { ForIteratingProgressProps } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { ForTask } from '../tasks/for-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { ForCheckingProgress } from './for-checking-progress.js';
import { KindProgress } from './kind-progress.js';

// A `for` running its body for one item. The body's output is the next item's data.
export class ForIteratingProgress extends KindProgress {
  readonly #iteration: ForIteration;
  readonly #sequence: Sequence;

  constructor(props: ForIteratingProgressProps) {
    super();

    if (props.iteration.isOver())
      throw new InconsistentProgressError(
        'a for runs its body only for an item',
      );

    this.#iteration = props.iteration;
    this.#sequence = props.sequence;
  }

  // What follows the iterations so far: the end of the loop, the `while` check or the next item.
  static iterate(
    iteration: ForIteration,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const task = scope.task;
    const unchanged = !task.isGuarded() && task.body.isEmpty();

    if (iteration.isOver() || unchanged) {
      const completed = Outcome.of(iteration.data);
      return ConcludedProgress.step(completed);
    }

    if (!task.isGuarded()) return ForIteratingProgress.start(iteration, scope);

    const checking = new ForCheckingProgress(iteration);
    return Step.of<KindProgress>(checking);
  }

  static start(
    iteration: ForIteration,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const additions = scope.task.variablesFor(iteration);
    const variables = scope.variablesWith(additions);
    const step = Sequence.start(scope.task.body, iteration.data, variables);
    return ForIteratingProgress.#following(iteration, step, scope);
  }

  static #following(
    iteration: ForIteration,
    step: Step<Sequence | Outcome>,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const next = step.progress;

    if (!(next instanceof Outcome)) {
      const iterating = new ForIteratingProgress({ iteration, sequence: next });
      return new Step<KindProgress>(iterating, step.starts);
    }

    if (next.failure !== null || next.endsWorkflow())
      return ConcludedProgress.step(next);

    const following = iteration.next(next.output);
    return ForIteratingProgress.iterate(following, scope);
  }

  get iteration(): ForIteration {
    return this.#iteration;
  }

  get sequence(): Sequence {
    return this.#sequence;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: BodyScope<ForTask>,
  ): Step<KindProgress> {
    const step = this.#sequence.childEnded(child, ending, scope.task.body);
    return ForIteratingProgress.#following(this.#iteration, step, scope);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
