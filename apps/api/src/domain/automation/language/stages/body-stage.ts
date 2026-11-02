import { InconsistentProgressError } from '../../../errors.js';
import type { SubWorkflowAnswer } from '../answers/sub-workflow-answer.js';
import type {
  BodyStageProps,
  SubWorkflowRequest,
  JsonValue,
} from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { Phase } from '../phase.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import { EndedStage } from './ended-stage.js';
import { OutputStage } from './output-stage.js';
import { TaskProgress } from './task-progress.js';
import type { DueTime } from '../due-time.js';

export class BodyStage extends TaskProgress {
  readonly #input: JsonValue;
  readonly #deadline: DueTime;
  readonly #body: KindProgress;

  constructor(props: BodyStageProps) {
    super();

    if (props.body.outcome() !== null)
      throw new InconsistentProgressError(
        'a task stays in its body only while the body runs',
      );

    this.#input = props.input;
    this.#deadline = props.deadline;
    this.#body = props.body;
  }

  static enter(
    input: JsonValue,
    deadline: DueTime,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const bodyScope = scope.forBody(input, deadline);
    const step = scope.task.enter(bodyScope);
    return BodyStage.#following(input, deadline, step, scope);
  }

  static #following(
    input: JsonValue,
    deadline: DueTime,
    step: Step<KindProgress>,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const body = step.progress;
    const outcome = body.outcome();

    if (outcome === null) {
      const running = new BodyStage({ input, deadline, body });
      return step.toward<TaskProgress>(running);
    }

    const failure = outcome.failure;

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return step.toward<TaskProgress>(faulted);
    }

    const output = OutputStage.enter({ input, deadline, outcome }, scope);
    return step.toward(output.progress);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get body(): KindProgress {
    return this.#body;
  }

  override deadline(): DueTime {
    return this.#deadline;
  }

  override wakeAt(): DueTime {
    return this.#body.wakeAt();
  }

  override subWorkflow(): SubWorkflowRequest | null {
    return this.#body.subWorkflow();
  }

  override phase(): Phase {
    const parked =
      !this.#body.wakeAt().isNone() || this.#body.subWorkflow() !== null;

    if (parked) return Phase.Waiting;

    return Phase.Running;
  }

  override runsBody(): boolean {
    return true;
  }

  work(scope: TaskScope): RoundWork {
    const bodyScope = scope.forBody(this.#input, this.#deadline);
    return this.#body.work(bodyScope);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const bodyScope = scope.forBody(this.#input, this.#deadline);
    const step = this.#body.record(results, bodyScope);

    if (step.progress === this.#body) return Step.of<TaskProgress>(this);

    return BodyStage.#following(this.#input, this.#deadline, step, scope);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const bodyScope = scope.forBody(this.#input, this.#deadline);
    const step = this.#body.childEnded(child, ending, bodyScope);

    if (step.progress === this.#body) return Step.of<TaskProgress>(this);

    return BodyStage.#following(this.#input, this.#deadline, step, scope);
  }

  subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const bodyScope = scope.forBody(this.#input, this.#deadline);
    const step = this.#body.subWorkflowAnswered(answer, bodyScope);

    if (step.progress === this.#body) return Step.of<TaskProgress>(this);

    return BodyStage.#following(this.#input, this.#deadline, step, scope);
  }

  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }
}
