import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { SwitchTask } from '../tasks/switch-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class SwitchProgress extends KindProgress {
  static enter(scope: BodyScope<SwitchTask>): Step<KindProgress> {
    const progress = new SwitchProgress();
    return progress.settled(scope);
  }

  work(scope: BodyScope<SwitchTask>): RoundWork {
    const args = scope.definitionArguments();
    const evaluations = scope.task.evaluationsFor(scope.key, scope.input, args);
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: BodyScope<SwitchTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const outcome = scope.task.outcomeFor(scope.input, scope.key, results);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
