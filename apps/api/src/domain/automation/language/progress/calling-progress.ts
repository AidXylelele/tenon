import type { ServiceCall } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import type { CallTask } from '../tasks/call-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

// Stage 3 of a call: the request is out, and its result decides the outcome.
export class CallingProgress extends KindProgress {
  readonly #call: ServiceCall;

  constructor(call: ServiceCall) {
    super();
    this.#call = call;
  }

  get call(): ServiceCall {
    return this.#call;
  }

  work(): RoundWork {
    return RoundWork.calling(this.#call);
  }

  record(
    results: RoundResults,
    scope: BodyScope<CallTask>,
  ): Step<KindProgress> {
    const result = results.response(this.#call.id);

    if (result === null) return Step.of<KindProgress>(this);

    const at = scope.task.reference;
    const outcome = result.outcome(scope.task.output, at);
    return ConcludedProgress.step(outcome);
  }

  childEnded(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
