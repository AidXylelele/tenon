import type { ChildRequest } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { Outcome } from '../outcome.js';
import { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';

export abstract class KindProgress {
  outcome(): Outcome | null {
    return null;
  }

  wakeAt(): Date | null {
    return null;
  }

  child(): ChildRequest | null {
    return null;
  }

  abstract work(scope: TaskScope): RoundWork;

  abstract record(results: RoundResults, scope: TaskScope): Step<KindProgress>;

  abstract childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<KindProgress>;

  protected settled(scope: TaskScope): Step<KindProgress> {
    const work = this.work(scope);

    if (!work.isEmpty()) return Step.of<KindProgress>(this);

    const none = RoundResults.none();
    return this.record(none, scope);
  }
}
