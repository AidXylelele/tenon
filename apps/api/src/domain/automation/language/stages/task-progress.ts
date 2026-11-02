import type { SubWorkflowAnswer } from '../answers/sub-workflow-answer.js';
import type { SubWorkflowRequest } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Phase } from '../phase.js';
import { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../endings/task-ending.js';
import { DueTime } from '../due-time.js';

export abstract class TaskProgress {
  ending(): TaskEnding | null {
    return null;
  }

  deadline(): DueTime {
    return DueTime.None;
  }

  wakeAt(): DueTime {
    return DueTime.None;
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

  // The stage evaluates `export.as` on the workflow's context.
  evaluatesExport(): boolean {
    return false;
  }

  // The stage holds an evaluated export that replaces the workflow's context when the task ends.
  holdsExport(): boolean {
    return false;
  }

  abstract work(scope: TaskScope): RoundWork;

  abstract record(results: RoundResults, scope: TaskScope): Step<TaskProgress>;

  abstract childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<TaskProgress>;

  abstract subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: TaskScope,
  ): Step<TaskProgress>;

  abstract timeOut(scope: TaskScope): TaskProgress;

  protected settled(scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    // A stage with work waits for its answers, and an ended one has nothing left to do.
    const stays = !work.isEmpty() || this.ending() !== null;

    if (stays) return Step.of<TaskProgress>(this);

    const none = RoundResults.none();
    return this.record(none, scope);
  }
}
