import { InconsistentProgressError } from '../../../errors.js';
import type { ExportStageProps, JsonValue } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { WorkflowError } from '../workflow-error.js';
import { EndedStage } from './ended-stage.js';
import { ExportCheckStage } from './export-check-stage.js';
import { TaskProgress } from './task-progress.js';

export class ExportStage extends TaskProgress {
  readonly #input: JsonValue;
  readonly #deadline: Date | null;
  readonly #outcome: Outcome;
  readonly #output: JsonValue;

  constructor(props: ExportStageProps) {
    super();

    if (props.outcome.failure !== null)
      throw new InconsistentProgressError(
        'a task whose body failed has no output to transform',
      );

    this.#input = props.input;
    this.#deadline = props.deadline;
    this.#outcome = props.outcome;
    this.#output = props.output;
  }

  static enter(props: ExportStageProps, scope: TaskScope): Step<TaskProgress> {
    const stage = new ExportStage(props);
    return stage.settled(scope);
  }

  get input(): JsonValue {
    return this.#input;
  }

  get outcome(): Outcome {
    return this.#outcome;
  }

  get output(): JsonValue {
    return this.#output;
  }

  override deadline(): Date | null {
    return this.#deadline;
  }

  override exportsContext(): boolean {
    return true;
  }

  work(scope: TaskScope): RoundWork {
    const base = scope.task.base;
    const validations = base.output.validationsFor(scope.prefix, this.#output);
    const args = scope.exportArguments(
      this.#input,
      this.#outcome.output,
      this.#output,
      this.#outcome.authorization,
    );
    const evaluations = base.export.evaluationsFor(
      scope.prefix,
      this.#output,
      args,
    );
    return new RoundWork({
      evaluations,
      validations,
      calls: [],
      processes: [],
    });
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
    const context = exporting.contextFrom(scope.prefix, results, scope.context);
    const exported = exporting.changesContext();
    return ExportCheckStage.enter(
      {
        deadline: this.#deadline,
        outcome: this.#outcome,
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

  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }

  #failureIn(results: RoundResults, scope: TaskScope): WorkflowError | null {
    const base = scope.task.base;
    const at = scope.task.reference;
    const invalid = base.output.validationFailureIn(scope.prefix, results, at);

    if (invalid !== null) return invalid;

    return base.export.failureIn(scope.prefix, results, at);
  }

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
