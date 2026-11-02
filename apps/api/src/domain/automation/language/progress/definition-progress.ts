import type { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { LeafTask } from '../tasks/leaf-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

// Stage 2 of a leaf task: its definition's templates on the transformed input. Once they are
// answered, the first failure faults the task, and otherwise the task decides what follows.
export class DefinitionProgress extends KindProgress {
  static enter(scope: BodyScope<LeafTask>): Step<KindProgress> {
    const progress = new DefinitionProgress();
    return progress.settled(scope);
  }

  work(scope: BodyScope<LeafTask>): RoundWork {
    const templates = scope.task.templates;
    return scope.evaluating(templates);
  }

  record(
    results: RoundResults,
    scope: BodyScope<LeafTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const templates = scope.task.templates;
    const failure = scope.failureIn(templates, results);

    if (failure !== null) return ConcludedProgress.failed(failure);

    return scope.task.defined(results, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
