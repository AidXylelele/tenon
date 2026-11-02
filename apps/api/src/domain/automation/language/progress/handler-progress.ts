import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Sequence } from '../sequence.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { TaskList } from '../task-list.js';
import type { TryTask } from '../tasks/try-task.js';
import type { WorkflowError } from '../workflow-error.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class HandlerProgress extends KindProgress {
  readonly #sequence: Sequence;

  constructor(sequence: Sequence) {
    super();
    this.#sequence = sequence;
  }

  static enter(
    handler: TaskList,
    error: WorkflowError,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const additions = scope.task.catchClause.variablesFor(error);
    const variables = scope.variablesWith(additions);
    const step = Sequence.start(handler, scope.input, variables);
    return HandlerProgress.#following(step);
  }

  static #following(step: Step<Sequence | Outcome>): Step<KindProgress> {
    const next = step.progress;

    if (next instanceof Outcome) return ConcludedProgress.step(next);

    const handling = new HandlerProgress(next);
    return new Step<KindProgress>(handling, step.starts);
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
    const handler = scope.task.catchClause.handler;

    if (handler === null) return Step.of<KindProgress>(this);

    const step = this.#sequence.childEnded(child, ending, handler);
    return HandlerProgress.#following(step);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
