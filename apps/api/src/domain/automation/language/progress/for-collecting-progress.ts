import { ErrorType } from '../error-type.js';
import { ForIteration } from '../for-iteration.js';
import type { JsonValue } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { ForTask } from '../tasks/for-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { ForIteratingProgress } from './for-iterating-progress.js';
import { KindProgress } from './kind-progress.js';

// The first state of a `for`: its collection, evaluated on the task's input.
export class ForCollectingProgress extends KindProgress {
  static readonly #NOT_A_COLLECTION = 'The for collection is not an array';

  static enter(): Step<KindProgress> {
    const collecting = new ForCollectingProgress();
    return Step.of<KindProgress>(collecting);
  }

  work(scope: BodyScope<ForTask>): RoundWork {
    const args = scope.definitionArguments();
    const collection = scope.task.collection;
    const evaluations = collection.evaluationsFor(scope.key, scope.input, args);
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: BodyScope<ForTask>): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const collection = scope.task.collection;
    const at = scope.task.reference;
    const failure = collection.failureIn(scope.key, results, at);

    if (failure !== null) return ConcludedProgress.failed(failure);

    const value = collection.fill(scope.key, results);

    if (value !== null && !Array.isArray(value)) {
      const error = ErrorType.Expression.errorAt(
        at,
        ForCollectingProgress.#NOT_A_COLLECTION,
      );
      return ConcludedProgress.failed(error);
    }

    const none: readonly JsonValue[] = [];
    const items = value ?? none;
    const first = ForIteration.first(items, scope.input);
    return ForIteratingProgress.iterate(first, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
