import type { ChildRequest } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';

export abstract class TaskProgress {
  ending(): TaskEnding | null {
    return null;
  }

  deadline(): Date | null {
    return null;
  }

  wakeAt(): Date | null {
    return null;
  }

  child(): ChildRequest | null {
    return null;
  }

  abstract work(scope: TaskScope): RoundWork;

  abstract record(results: RoundResults, scope: TaskScope): Step<TaskProgress>;

  abstract childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<TaskProgress>;

  abstract timeOut(scope: TaskScope): TaskProgress;

  protected settled(scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const waiting = !work.isEmpty() || this.ending() !== null;

    if (waiting) return Step.of<TaskProgress>(this);

    const none = RoundResults.none();
    return this.record(none, scope);
  }
}
