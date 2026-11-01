import type { SubWorkflowRequest } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { Outcome } from '../outcome.js';
import { Phase } from '../phase.js';
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

  subWorkflow(): SubWorkflowRequest | null {
    return null;
  }

  phase(): Phase | null {
    return Phase.Running;
  }

  runsBody(): boolean {
    return false;
  }

  abstract work(scope: TaskScope): RoundWork;

  abstract record(results: RoundResults, scope: TaskScope): Step<TaskProgress>;

  abstract childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<TaskProgress>;

  abstract subWorkflowEnded(
    outcome: Outcome,
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
