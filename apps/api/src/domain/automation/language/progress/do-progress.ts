import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { DoTask } from '../tasks/do-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class DoProgress extends KindProgress {
  readonly #sequence: Sequence;

  constructor(sequence: Sequence) {
    super();
    this.#sequence = sequence;
  }

  static enter(scope: BodyScope<DoTask>): Step<KindProgress> {
    const step = Sequence.start(scope.task.body, scope.input, scope.variables);
    return DoProgress.#following(step);
  }

  static #following(step: Step<Sequence | Outcome>): Step<KindProgress> {
    const next = step.progress;

    if (next instanceof Outcome) return ConcludedProgress.step(next);

    const progress = new DoProgress(next);
    return new Step<KindProgress>(progress, step.starts);
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
    scope: BodyScope<DoTask>,
  ): Step<KindProgress> {
    const step = this.#sequence.childEnded(child, ending, scope.task.body);
    return DoProgress.#following(step);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
