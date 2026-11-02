import type { SubWorkflowAnswer } from '../answers/sub-workflow-answer.js';
import type { SubWorkflowRequest } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { Outcome } from '../outcome.js';
import { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';

export abstract class KindProgress {
  outcome(): Outcome | null {
    return null;
  }

  wakeAt(): Date | null {
    return null;
  }

  subWorkflow(): SubWorkflowRequest | null {
    return null;
  }

  abstract work(scope: BodyScope): RoundWork;

  abstract record(results: RoundResults, scope: BodyScope): Step<KindProgress>;

  abstract childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: BodyScope,
  ): Step<KindProgress>;

  abstract subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: BodyScope,
  ): Step<KindProgress>;

  protected settled(scope: BodyScope): Step<KindProgress> {
    const work = this.work(scope);

    if (!work.isEmpty()) return Step.of<KindProgress>(this);

    const none = RoundResults.none();
    return this.record(none, scope);
  }
}
