import type { ExportStageProps, JsonValue } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { WorkflowError } from '../workflow-error.js';
import { EndedStage } from './ended-stage.js';
import { ExportCheckStage } from './export-check-stage.js';
import { ResultStage } from './result-stage.js';
import type { TaskProgress } from './task-progress.js';

export class ExportStage extends ResultStage {
  readonly #input: JsonValue;
  readonly #output: JsonValue;

  constructor(props: ExportStageProps) {
    super(props);
    this.#input = props.input;
    this.#output = props.output;
  }

  static enter(props: ExportStageProps, scope: TaskScope): Step<TaskProgress> {
    const stage = new ExportStage(props);
    return stage.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get output(): JsonValue {
    return this.#output;
  }

  override evaluatesExport(): boolean {
    return true;
  }

  work(scope: TaskScope): RoundWork {
    const base = scope.task.base;
    const validations = base.output.validationsFor(scope.key, this.#output);
    const args = scope.exportArguments(
      this.#input,
      this.outcome.output,
      this.#output,
      this.outcome.authorization,
    );
    const evaluations = base.export.evaluationsFor(
      scope.key,
      this.#output,
      args,
    );
    return RoundWork.checking(evaluations, validations);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<TaskProgress>(this);

    const failure = this.#failureIn(results, scope);

    if (failure !== null) {
      const faulted = EndedStage.faulted(failure);
      return Step.of<TaskProgress>(faulted);
    }

    const exporting = scope.task.base.export;
    const context = exporting.contextFrom(scope.key, results, scope.context);
    const exported = exporting.changesContext();
    const deadline = this.deadline();
    return ExportCheckStage.enter(
      {
        deadline,
        outcome: this.outcome,
        output: this.#output,
        context,
        exported,
      },
      scope,
    );
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  #failureIn(results: RoundResults, scope: TaskScope): WorkflowError | null {
    const base = scope.task.base;
    const at = scope.task.reference;
    const invalid = base.output.validationFailureIn(scope.key, results, at);

    if (invalid !== null) return invalid;

    return base.export.failureIn(scope.key, results, at);
  }

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
