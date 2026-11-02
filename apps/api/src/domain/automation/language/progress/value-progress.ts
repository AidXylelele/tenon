import type { ValueTask } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class ValueProgress extends KindProgress {
  static enter(scope: BodyScope): Step<KindProgress> {
    const progress = new ValueProgress();
    return progress.settled(scope);
  }

  work(scope: BodyScope<ValueTask>): RoundWork {
    const args = scope.definitionArguments();
    const template = scope.task.template;
    const evaluations = template.evaluationsFor(
      scope.prefix,
      scope.input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: BodyScope<ValueTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const template = scope.task.template;
    const at = scope.task.reference;
    const failure = template.failureIn(scope.prefix, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const value = template.fill(scope.prefix, results);
    const outcome = scope.task.outcomeOf(value, scope);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
