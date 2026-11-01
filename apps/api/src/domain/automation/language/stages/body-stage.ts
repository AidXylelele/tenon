import type { BodyStageProps, ChildRequest, JsonValue } from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { RoundResults } from '../round-results.js';
import type { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../task-ending.js';
import { EndedStage } from './ended-stage.js';
import { OutputStage } from './output-stage.js';
import { TaskProgress } from './task-progress.js';

export class BodyStage extends TaskProgress {
  readonly #input: JsonValue;
  readonly #deadline: Date | null;
  readonly #body: KindProgress;

  constructor(props: BodyStageProps) {
    super();
    this.#input = props.input;
    this.#deadline = props.deadline;
    this.#body = props.body;
  }

  static enter(
    input: JsonValue,
    deadline: Date | null,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const step = scope.task.enter(input, scope);
    return BodyStage.#following(input, deadline, step, scope);
  }

  static #following(
    input: JsonValue,
    deadline: Date | null,
    step: Step<KindProgress>,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const body = step.progress;
    const outcome = body.outcome();

    if (outcome === null) {
      const running = new BodyStage({ input, deadline, body });
      return new Step<TaskProgress>(running, step.starts);
    }

    const failure = outcome.failure;

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return new Step<TaskProgress>(faulted, step.starts);
    }

    const output = OutputStage.enter({ input, deadline, outcome }, scope);
    return new Step(output.progress, step.starts);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get body(): KindProgress {
    return this.#body;
  }

  override deadline(): Date | null {
    return this.#deadline;
  }

  override wakeAt(): Date | null {
    return this.#body.wakeAt();
  }

  override child(): ChildRequest | null {
    return this.#body.child();
  }

  work(scope: TaskScope): RoundWork {
    return this.#body.work(scope);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const step = this.#body.record(results, scope);
    return BodyStage.#following(this.#input, this.#deadline, step, scope);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const step = this.#body.childEnded(child, ending, scope);
    return BodyStage.#following(this.#input, this.#deadline, step, scope);
  }

  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }
}
