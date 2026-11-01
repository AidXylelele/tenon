import { Attempt } from '../attempt.js';
import type { JsonValue, TryProgressProps } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { TryTask } from '../tasks/try-task.js';
import type { WorkflowError } from '../workflow-error.js';
import { CatchProgress } from './catch-progress.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class TryProgress extends KindProgress {
  readonly #input: JsonValue;
  readonly #attempt: Attempt;
  readonly #sequence: Sequence;

  constructor(props: TryProgressProps) {
    super();
    this.#input = props.input;
    this.#attempt = props.attempt;
    this.#sequence = props.sequence;
  }

  static enter(
    input: JsonValue,
    scope: TaskScope<TryTask>,
  ): Step<KindProgress> {
    const first = Attempt.first(scope.now);
    return TryProgress.attempt(input, first, scope);
  }

  static attempt(
    input: JsonValue,
    attempt: Attempt,
    scope: TaskScope<TryTask>,
  ): Step<KindProgress> {
    const step = Sequence.start(scope.task.body, input, scope.variables);
    const trying = new TryProgress({
      input,
      attempt,
      sequence: step.progress,
    });
    return trying.#following(step, scope);
  }

  get input(): JsonValue {
    return this.#input;
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
    scope: TaskScope<TryTask>,
  ): Step<KindProgress> {
    const step = this.#sequence.childEnded(child, ending, scope.task.body);
    return this.#following(step, scope);
  }

  #following(
    step: Step<Sequence>,
    scope: TaskScope<TryTask>,
  ): Step<KindProgress> {
    const sequence = step.progress;
    const outcome = sequence.outcome;

    if (outcome === null) {
      const trying = new TryProgress({
        input: this.#input,
        attempt: this.#attempt,
        sequence,
      });
      return new Step<KindProgress>(trying, step.starts);
    }

    const failure = outcome.failure;

    if (failure === null) return ConcludedProgress.step(outcome);

    return this.#failed(failure, scope);
  }

  #failed(error: WorkflowError, scope: TaskScope<TryTask>): Step<KindProgress> {
    const filtered = scope.task.catchClause.filters(error);

    if (!filtered) {
      const uncaught = Outcome.failed(error);
      return ConcludedProgress.step(uncaught);
    }

    return CatchProgress.enter(
      {
        input: this.#input,
        attempt: this.#attempt,
        error,
      },
      scope,
    );
  }
}
