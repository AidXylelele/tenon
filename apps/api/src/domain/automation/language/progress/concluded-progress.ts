import type { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import { Step } from '../step.js';
import { KindProgress } from './kind-progress.js';

export class ConcludedProgress extends KindProgress {
  readonly #outcome: Outcome;

  constructor(outcome: Outcome) {
    super();
    this.#outcome = outcome;
  }

  static step(outcome: Outcome): Step<KindProgress> {
    const concluded = new ConcludedProgress(outcome);
    return Step.of<KindProgress>(concluded);
  }

  override outcome(): Outcome {
    return this.#outcome;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
