import type { ExportCheckStageProps, JsonValue } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import { EndedStage } from './ended-stage.js';
import { ResultStage } from './result-stage.js';
import type { TaskProgress } from './task-progress.js';
import { CompletedEnding } from '../endings/completed-ending.js';

export class ExportCheckStage extends ResultStage {
  readonly #output: JsonValue;
  readonly #context: JsonValue;
  readonly #exported: boolean;

  constructor(props: ExportCheckStageProps) {
    super(props);
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

  get output(): JsonValue {
    return this.#output;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get exported(): boolean {
    return this.#exported;
  }

  work(scope: TaskScope): RoundWork {
    const exporting = scope.task.base.export;
    const validations = exporting.validationsFor(scope.prefix, this.#context);
    return RoundWork.validating(validations);
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

    const ending = new CompletedEnding({
      output: this.#output,
      then: scope.task.base.then,
      exported: this.#exported,
      context: this.#context,
      outcome: this.outcome,
    });
    const ended = new EndedStage(ending);
    return Step.of<TaskProgress>(ended);
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
