import type { ExportCheckStageProps, JsonValue } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { TaskEnding } from '../task-ending.js';
import { EndedStage } from './ended-stage.js';
import { TaskProgress } from './task-progress.js';

export class ExportCheckStage extends TaskProgress {
  readonly #deadline: Date | null;
  readonly #outcome: Outcome;
  readonly #output: JsonValue;
  readonly #context: JsonValue;
  readonly #exported: boolean;

  constructor(props: ExportCheckStageProps) {
    super();
    this.#deadline = props.deadline;
    this.#outcome = props.outcome;
    this.#output = props.output;
    this.#context = props.context;
    this.#exported = props.exported;
  }

  static enter(
    props: ExportCheckStageProps,
    scope: TaskScope,
  ): Step<TaskProgress> {
    const stage = new ExportCheckStage(props);
    return stage.settled(scope);
  }

  get outcome(): Outcome {
    return this.#outcome;
  }

  get output(): JsonValue {
    return this.#output;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get exported(): boolean {
    return this.#exported;
  }

  override deadline(): Date | null {
    return this.#deadline;
  }

  work(scope: TaskScope): RoundWork {
    const exporting = scope.task.base.export;
    const validations = exporting.validationsFor(scope.prefix, this.#context);
    return new RoundWork({
      evaluations: [],
      validations,
      calls: [],
      processes: [],
    });
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<TaskProgress>(this);

    const exporting = scope.task.base.export;
    const at = scope.task.reference;
    const failure = exporting.validationFailureIn(scope.prefix, results, at);

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return Step.of<TaskProgress>(faulted);
    }

    const directive = this.#outcome.directive ?? scope.task.base.then;
    const ending = TaskEnding.completed({
      output: this.#output,
      directive,
      exported: this.#exported,
      context: this.#context,
      outcome: this.#outcome,
    });
    const ended = new EndedStage(ending);
    return Step.of<TaskProgress>(ended);
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }
}
