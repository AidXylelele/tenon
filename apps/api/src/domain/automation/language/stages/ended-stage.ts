import { ErrorType } from '../error-type.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { TaskEnding } from '../task-ending.js';
import type { WorkflowError } from '../workflow-error.js';
import { TaskProgress } from './task-progress.js';

export class EndedStage extends TaskProgress {
  readonly #ending: TaskEnding;

  constructor(ending: TaskEnding) {
    super();
    this.#ending = ending;
  }

  static faulted(error: WorkflowError): EndedStage {
    const ending = TaskEnding.faulted(error);
    return new EndedStage(ending);
  }

  static timedOut(scope: TaskScope): EndedStage {
    const error = ErrorType.Timeout.errorAt(scope.task.reference, null);
    return EndedStage.faulted(error);
  }

  static skipped(scope: TaskScope): EndedStage {
    const ending = TaskEnding.skipped(scope.rawInput, scope.task.base.then);
    return new EndedStage(ending);
  }

  override ending(): TaskEnding {
    return this.#ending;
  }

  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  timeOut(): TaskProgress {
    return this;
  }
}
