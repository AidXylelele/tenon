import { Attempt } from '../attempt.js';
import type { TryProgressProps } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../endings/task-ending.js';
import type { TryTask } from '../tasks/try-task.js';
import type { WorkflowError } from '../workflow-error.js';
import { CatchProgress } from './catch-progress.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class TryProgress extends KindProgress {
  readonly #attempt: Attempt;
  readonly #sequence: Sequence;

  constructor(props: TryProgressProps) {
    super();
    this.#attempt = props.attempt;
    this.#sequence = props.sequence;
  }

  static enter(scope: BodyScope<TryTask>): Step<KindProgress> {
    const first = Attempt.first(scope.now);
    return TryProgress.attempt(first, scope);
  }

  static attempt(
    attempt: Attempt,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const step = Sequence.start(scope.task.body, scope.input, scope.variables);
    return TryProgress.#following(attempt, step, scope);
  }

  static #following(
    attempt: Attempt,
    step: Step<Sequence | Outcome>,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const next = step.progress;

    if (!(next instanceof Outcome)) {
      const trying = new TryProgress({ attempt, sequence: next });
      return new Step<KindProgress>(trying, step.starts);
    }

    const failure = next.failure;

    if (failure === null) return ConcludedProgress.step(next);

    return TryProgress.#failed(attempt, failure, scope);
  }

  static #failed(
    attempt: Attempt,
    error: WorkflowError,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const filtered = scope.task.catchClause.filters(error);

    if (!filtered) {
      const uncaught = Outcome.failed(error);
      return ConcludedProgress.step(uncaught);
    }

    return CatchProgress.enter({ attempt, error }, scope);
  }

  get attempt(): Attempt {
    return this.#attempt;
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
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const step = this.#sequence.childEnded(child, ending, scope.task.body);
    return TryProgress.#following(this.#attempt, step, scope);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
