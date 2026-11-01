import type { JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
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

  static enter(input: JsonValue, scope: TaskScope<DoTask>): Step<KindProgress> {
    const step = Sequence.start(scope.task.body, input, scope.variables);
    return DoProgress.#following(step);
  }

  static #following(step: Step<Sequence>): Step<KindProgress> {
    const sequence = step.progress;
    const outcome = sequence.outcome;

    if (outcome !== null) return ConcludedProgress.step(outcome);

    const progress = new DoProgress(sequence);
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
    scope: TaskScope<DoTask>,
  ): Step<KindProgress> {
    const step = this.#sequence.childEnded(child, ending, scope.task.body);
    return DoProgress.#following(step);
  }
}
