import { InconsistentProgressError } from '../../../errors.js';
import type { Attempt } from '../attempt.js';
import type { RetryProgressProps } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { TryTask } from '../tasks/try-task.js';
import { KindProgress } from './kind-progress.js';
import { TryProgress } from './try-progress.js';

export class RetryProgress extends KindProgress {
  readonly #attempt: Attempt;
  readonly #wakeAt: Date;

  constructor(props: RetryProgressProps) {
    super();

    if (props.attempt.isFirst())
      throw new InconsistentProgressError('a retry follows a failed attempt');

    this.#attempt = props.attempt;
    this.#wakeAt = props.wakeAt;
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

  record(results: RoundResults, scope: BodyScope<TryTask>): Step<KindProgress> {
    if (scope.now < this.#wakeAt) return Step.of<KindProgress>(this);

    const attempt = TryProgress.attempt(this.#attempt, scope);
    return attempt.asRetry();
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
