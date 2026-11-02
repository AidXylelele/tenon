import type { Attempt } from '../attempt.js';
import type { CatchProgressProps, JsonObject } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { RetryStrategy } from '../retry-strategy.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { TryTask } from '../tasks/try-task.js';
import type { WorkflowError } from '../workflow-error.js';
import { ConcludedProgress } from './concluded-progress.js';
import { HandlerProgress } from './handler-progress.js';
import { KindProgress } from './kind-progress.js';
import type { WorkKey } from '../work-key.js';
import { RetryProgress } from './retry-progress.js';

export class CatchProgress extends KindProgress {
  static readonly #CATCH = 'catch';
  static readonly #RETRY = 'retry';

  readonly #attempt: Attempt;
  readonly #error: WorkflowError;

  constructor(props: CatchProgressProps) {
    super();
    this.#attempt = props.attempt;
    this.#error = props.error;
  }

  static enter(
    props: CatchProgressProps,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const catching = new CatchProgress(props);
    return catching.settled(scope);
  }

  get attempt(): Attempt {
    return this.#attempt;
  }

  get error(): WorkflowError {
    return this.#error;
  }

  work(scope: BodyScope<TryTask>): RoundWork {
    const args = this.#arguments(scope);
    const key = this.#key(scope);
    const evaluations = scope.task.catchClause.evaluationsFor(
      key,
      scope.input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(results: RoundResults, scope: BodyScope<TryTask>): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<KindProgress>(this);

    const clause = scope.task.catchClause;
    const key = this.#key(scope);
    const at = scope.task.reference;
    const failure = clause.failureIn(key, results, at);

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const caught = clause.catches(key, results);

    if (!caught) {
      const uncaught = Outcome.failed(this.#error);
      return ConcludedProgress.step(uncaught);
    }

    const retry = clause.retry;
    const retries = clause.retries(key, results);

    if (retry !== null && retries) return this.#retrying(retry, scope);

    const completed = Outcome.of(scope.input);
    return this.#handled(completed, scope);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  #retrying(
    retry: RetryStrategy,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const attempt = this.#attempt.next();
    const workId = scope.key.countedIdFor(CatchProgress.#RETRY, attempt.count);
    const delay = retry.delayFor(attempt.count, workId);
    const allowed = retry.allows(attempt, delay, scope.now);

    if (!allowed) {
      const failed = Outcome.failed(this.#error);
      return this.#handled(failed, scope);
    }

    const resumesAt = scope.now.getTime() + delay;
    const wakeAt = new Date(resumesAt);
    const parked = new RetryProgress({ attempt, wakeAt });
    return Step.of<KindProgress>(parked);
  }

  #handled(
    withoutHandler: Outcome,
    scope: BodyScope<TryTask>,
  ): Step<KindProgress> {
    const handler = scope.task.catchClause.handler;

    if (handler === null) return ConcludedProgress.step(withoutHandler);

    return HandlerProgress.enter(handler, this.#error, scope);
  }

  #arguments(scope: BodyScope<TryTask>): JsonObject {
    const additions = scope.task.catchClause.variablesFor(this.#error);
    return scope.definitionArgumentsWith(additions);
  }

  #key(scope: BodyScope): WorkKey {
    const count = this.#attempt.count;
    return scope.key.within(CatchProgress.#CATCH, count);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
