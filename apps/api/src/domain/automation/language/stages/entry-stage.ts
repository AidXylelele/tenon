import { Phase } from '../phase.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Step } from '../step.js';
import type { WorkflowError } from '../workflow-error.js';
import { BodyStage } from './body-stage.js';
import { EndedStage } from './ended-stage.js';
import { ActiveStage } from './active-stage.js';
import type { TaskProgress } from './task-progress.js';
import { DueTime } from '../due-time.js';

export class EntryStage extends ActiveStage {
  static begin(scope: TaskScope): Step<TaskProgress> {
    const entry = new EntryStage();
    return entry.settled(scope);
  }

  override phase(): Phase {
    return Phase.Pending;
  }

  work(scope: TaskScope): RoundWork {
    const base = scope.task.base;
    const prefix = scope.prefix;
    const args = scope.entryArguments();
    const rawInput = scope.rawInput;
    const condition =
      base.condition?.evaluationsFor(prefix, rawInput, args) ?? [];
    const timeout = base.timeout?.evaluationsFor(prefix, rawInput, args) ?? [];
    const from = base.input.evaluationsFor(prefix, rawInput, args);
    const evaluations = condition.concat(timeout, from);
    const validations = base.input.validationsFor(prefix, rawInput);
    return RoundWork.checking(evaluations, validations);
  }

  record(results: RoundResults, scope: TaskScope): Step<TaskProgress> {
    const work = this.work(scope);
    const answered = results.answers(work);

    if (!answered) return Step.of<TaskProgress>(this);

    const condition = scope.task.base.condition;
    const at = scope.task.reference;
    const conditionFailure =
      condition?.failureIn(scope.prefix, results, at) ?? null;

    if (conditionFailure !== null) return this.#faulted(conditionFailure);

    const satisfied = condition?.holds(scope.prefix, results) ?? true;

    if (!satisfied) {
      const skipped = EndedStage.skipped(scope);
      return Step.of<TaskProgress>(skipped);
    }

    const failure = this.#inputFailure(results, scope);

    if (failure !== null) return this.#faulted(failure);

    const input = scope.task.base.input.valueFrom(
      scope.prefix,
      results,
      scope.rawInput,
    );
    const deadline = this.#deadlineFrom(results, scope);
    return BodyStage.enter(input, deadline, scope);
  }

  childEnded(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }

  #inputFailure(results: RoundResults, scope: TaskScope): WorkflowError | null {
    const base = scope.task.base;
    const at = scope.task.reference;
    const prefix = scope.prefix;
    const timeout = base.timeout?.failureIn(prefix, results, at) ?? null;

    if (timeout !== null) return timeout;

    return base.input.failureIn(prefix, results, at);
  }

  #deadlineFrom(results: RoundResults, scope: TaskScope): DueTime {
    const timeout = scope.task.base.timeout;

    if (timeout === null) return DueTime.None;

    const duration = timeout.resolve(scope.prefix, results);
    const end = duration.endFrom(scope.startedAt);
    return DueTime.of(end);
  }

  #faulted(error: WorkflowError): Step<TaskProgress> {
    const faulted = EndedStage.faulted(error);
    return Step.of<TaskProgress>(faulted);
  }

  subWorkflowAnswered(): Step<TaskProgress> {
    return Step.of<TaskProgress>(this);
  }
}
