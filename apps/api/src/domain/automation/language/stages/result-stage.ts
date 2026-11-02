import { InconsistentProgressError } from '../../../errors.js';
import type { DueTime } from '../due-time.js';
import type { ResultStageProps } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import { ActiveStage } from './active-stage.js';

// A stage after a body that did not fail: the body's outcome on its way to the task's output.
export abstract class ResultStage extends ActiveStage {
  readonly #deadline: DueTime;
  readonly #outcome: Outcome;

  protected constructor(props: ResultStageProps) {
    super();

    if (props.outcome.failure !== null)
      throw new InconsistentProgressError(
        'a task whose body failed has no output to transform',
      );

    this.#deadline = props.deadline;
    this.#outcome = props.outcome;
  }

  get outcome(): Outcome {
    return this.#outcome;
  }

  override deadline(): DueTime {
    return this.#deadline;
  }
}
