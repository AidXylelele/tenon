import { ErrorType } from '../error-type.js';
import type { Phase } from '../phase.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { type TaskEnding } from '../endings/task-ending.js';
import type { WorkflowError } from '../workflow-error.js';
import { TaskProgress } from './task-progress.js';
import { FaultedEnding } from '../endings/faulted-ending.js';
import { SkippedEnding } from '../endings/skipped-ending.js';

export class EndedStage extends TaskProgress {
  readonly #ending: TaskEnding;

  constructor(ending: TaskEnding) {
    super();
    this.#ending = ending;
  }

  static faulted(error: WorkflowError): EndedStage {
    const ending = new FaultedEnding(error);
    return new EndedStage(ending);
  }

  static timedOut(scope: TaskScope): EndedStage {
    const error = ErrorType.Timeout.errorAt(scope.task.reference, null);
    return EndedStage.faulted(error);
  }

  static skipped(scope: TaskScope): EndedStage {
    const ending = new SkippedEnding(scope.rawInput, scope.task.base.then);
    return new EndedStage(ending);
  }

  override ending(): TaskEnding {
    return this.#ending;
  }

  override phase(): Phase | null {
    return this.#ending.phase();
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

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
