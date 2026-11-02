import type { CallOutput } from '../call-output.js';
import type { JsonValue, ServiceCall } from '../interfaces.js';
import { CallingProgress } from '../progress/calling-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Step } from '../step.js';
import { LeafTask } from './leaf-task.js';

// `call: http` and `call: openapi`: the evaluated definition becomes a service call.
export abstract class CallTask extends LeafTask {
  static readonly #CALL = 'call';

  abstract get output(): CallOutput;

  defined(results: RoundResults, scope: BodyScope): Step<KindProgress> {
    const id = scope.workId(CallTask.#CALL);
    const deadline = scope.deadline.time;
    const call = this.callFrom(
      id,
      scope.prefix,
      results,
      scope.input,
      deadline,
    );
    const calling = new CallingProgress(call);
    return Step.of<KindProgress>(calling);
  }

  protected abstract callFrom(
    id: string,
    prefix: string,
    results: RoundResults,
    input: JsonValue,
    deadline: Date | null,
  ): ServiceCall;
}
