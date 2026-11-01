import type { Attempt } from '../attempt.js';
import type { JsonValue, RetryProgressProps } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TryTask } from '../tasks/try-task.js';
import { KindProgress } from './kind-progress.js';
import { TryProgress } from './try-progress.js';

export class RetryProgress extends KindProgress {
  readonly #input: JsonValue;
  readonly #attempt: Attempt;
  readonly #wakeAt: Date;

  constructor(props: RetryProgressProps) {
    super();
    this.#input = props.input;
    this.#attempt = props.attempt;
    this.#wakeAt = props.wakeAt;
  }

  get input(): JsonValue {
    return this.#input;
  }

  get attempt(): Attempt {
    return this.#attempt;
  }

  override wakeAt(): Date {
    return this.#wakeAt;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(results: RoundResults, scope: TaskScope<TryTask>): Step<KindProgress> {
    if (scope.now < this.#wakeAt) return Step.of<KindProgress>(this);

    return TryProgress.attempt(this.#input, this.#attempt, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
