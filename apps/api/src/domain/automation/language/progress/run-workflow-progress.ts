import type {
  ChildRequest,
  JsonValue,
  RunWorkflowProgressProps,
} from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import type { RunWorkflowTask } from '../tasks/run-workflow-task.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

export class RunWorkflowProgress extends KindProgress {
  readonly #input: JsonValue;
  readonly #child: ChildRequest | null;

  constructor(props: RunWorkflowProgressProps) {
    super();
    this.#input = props.input;
    this.#child = props.child;
  }

  static enter(
    input: JsonValue,
    scope: TaskScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    const progress = new RunWorkflowProgress({ input, child: null });
    return progress.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  override child(): ChildRequest | null {
    return this.#child;
  }

  work(scope: TaskScope<RunWorkflowTask>): RoundWork {
    const template = scope.task.input;

    if (this.#child !== null || template === null) return RoundWork.none();

    const args = scope.definitionArguments(this.#input);
    const evaluations = template.evaluationsFor(
      scope.prefix,
      this.#input,
      args,
    );
    return RoundWork.evaluating(evaluations);
  }

  record(
    results: RoundResults,
    scope: TaskScope<RunWorkflowTask>,
  ): Step<KindProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (this.#child !== null || !answered) return Step.of<KindProgress>(this);

    const template = scope.task.input;
    const at = scope.task.reference;
    const failure = template?.failureIn(scope.prefix, results, at) ?? null;

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return ConcludedProgress.step(failed);
    }

    const input = this.#childInput(results, scope);
    const child: ChildRequest = { target: scope.task.target, input };

    if (!scope.task.awaits) {
      const detached = Outcome.detachingWorkflow(this.#input, child);
      return ConcludedProgress.step(detached);
    }

    const awaiting = new RunWorkflowProgress({ input: this.#input, child });
    return Step.of<KindProgress>(awaiting);
  }

  childEnded(child: JsonPointer, ending: TaskEnding): Step<KindProgress> {
    if (this.#child === null) return Step.of<KindProgress>(this);

    const outcome = ending.outcome();
    return ConcludedProgress.step(outcome);
  }

  #childInput(
    results: RoundResults,
    scope: TaskScope<RunWorkflowTask>,
  ): JsonValue {
    const template = scope.task.input;

    if (template === null) return this.#input;

    return template.fill(scope.prefix, results);
  }
}
