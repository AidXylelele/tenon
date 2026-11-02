import type { SubWorkflowAnswer } from '../language/answers/sub-workflow-answer.js';
import type {
  JsonObject,
  JsonValue,
  SubWorkflowRequest,
} from '../language/interfaces.js';
import type { JsonPointer } from '../language/json-pointer.js';
import { Phase } from '../language/phase.js';
import type { RoundResults } from '../language/round-results.js';
import { RoundWork } from '../language/round-work.js';
import type { TaskScope } from '../language/scopes/task-scope.js';
import { EntryStage } from '../language/stages/entry-stage.js';
import type { TaskProgress } from '../language/stages/task-progress.js';
import { Step } from '../language/step.js';
import type { TaskEnding } from '../language/task-ending.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type {
  NewTaskInstance,
  TaskChange,
  TaskInstanceProps,
} from './interfaces.js';

export class TaskInstance {
  readonly #id: string;
  readonly #execution: number;
  readonly #reference: JsonPointer;
  readonly #name: string;
  readonly #parentId: string | null;
  readonly #rawInput: JsonValue;
  readonly #variables: JsonObject;
  readonly #startedAt: Date;
  #cancelled: boolean;
  #retries: number;
  #endedAt: Date | null;
  #progress: TaskProgress;

  constructor(props: TaskInstanceProps) {
    this.#id = props.id;
    this.#execution = props.execution;
    this.#reference = props.reference;
    this.#name = props.name;
    this.#parentId = props.parentId;
    this.#cancelled = props.cancelled;
    this.#rawInput = props.rawInput;
    this.#variables = props.variables;
    this.#retries = props.retries;
    this.#startedAt = props.startedAt;
    this.#endedAt = props.endedAt;
    this.#progress = props.progress;
  }

  static create(input: NewTaskInstance): TaskInstance {
    const progress = new EntryStage();
    return new TaskInstance({
      id: input.id,
      execution: input.execution,
      reference: input.start.reference,
      name: input.name,
      parentId: input.parentId,
      cancelled: false,
      rawInput: input.start.input,
      variables: input.start.variables,
      retries: 0,
      startedAt: input.now,
      endedAt: null,
      progress,
    });
  }

  get id(): string {
    return this.#id;
  }

  get execution(): number {
    return this.#execution;
  }

  get reference(): JsonPointer {
    return this.#reference;
  }

  get name(): string {
    return this.#name;
  }

  get parentId(): string | null {
    return this.#parentId;
  }

  get phase(): Phase | null {
    if (this.#cancelled) return Phase.Cancelled;

    return this.#progress.phase();
  }

  get rawInput(): JsonValue {
    return this.#rawInput;
  }

  get variables(): JsonObject {
    return this.#variables;
  }

  get output(): JsonValue {
    return this.#progress.ending()?.output ?? null;
  }

  get error(): WorkflowError | null {
    return this.#progress.ending()?.failure ?? null;
  }

  get retries(): number {
    return this.#retries;
  }

  get startedAt(): Date {
    return this.#startedAt;
  }

  get endedAt(): Date | null {
    return this.#endedAt;
  }

  get progress(): TaskProgress {
    return this.#progress;
  }

  isRoot(): boolean {
    return this.#parentId === null;
  }

  isSkipped(): boolean {
    return this.phase === null;
  }

  isTerminal(): boolean {
    return this.phase?.isTerminal() ?? true;
  }

  isCancelled(): boolean {
    return this.#cancelled;
  }

  runsBody(): boolean {
    return this.#progress.runsBody();
  }

  exportsContext(): boolean {
    return !this.isTerminal() && this.#progress.exportsContext();
  }

  requestedSubWorkflow(): SubWorkflowRequest | null {
    if (this.isTerminal()) return null;

    return this.#progress.subWorkflow();
  }

  deadline(): Date | null {
    return this.#progress.deadline();
  }

  hasElapsed(now: Date): boolean {
    const deadline = this.#progress.deadline();
    return deadline !== null && deadline <= now;
  }

  isDue(now: Date): boolean {
    const wakeAt = this.#progress.wakeAt();
    return wakeAt !== null && wakeAt <= now;
  }

  wakeAt(): Date | null {
    const wakeAt = this.#progress.wakeAt();
    const deadline = this.#progress.deadline();

    if (wakeAt === null) return deadline;

    if (deadline === null || wakeAt < deadline) return wakeAt;

    return deadline;
  }

  work(scope: TaskScope): RoundWork {
    if (this.isTerminal()) return RoundWork.none();

    return this.#progress.work(scope);
  }

  begin(scope: TaskScope): TaskChange {
    const step = EntryStage.begin(scope);
    return this.#advance(step, scope.now);
  }

  record(results: RoundResults, scope: TaskScope): TaskChange | null {
    if (this.isTerminal()) return null;

    const step = this.#progress.record(results, scope);
    return this.#changed(step, scope.now);
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    scope: TaskScope,
  ): TaskChange | null {
    if (this.isTerminal()) return null;

    const step = this.#progress.childEnded(child, ending, scope);
    return this.#changed(step, scope.now);
  }

  subWorkflowAnswered(
    answer: SubWorkflowAnswer,
    scope: TaskScope,
  ): TaskChange | null {
    if (this.isTerminal()) return null;

    const step = this.#progress.subWorkflowAnswered(answer, scope);
    return this.#changed(step, scope.now);
  }

  timeOut(scope: TaskScope): TaskChange | null {
    if (this.isTerminal()) return null;

    const timedOut = this.#progress.timeOut(scope);
    const step = Step.of(timedOut);
    return this.#advance(step, scope.now);
  }

  abandon(now: Date): boolean {
    if (this.isTerminal()) return false;

    const entered = this.phase !== Phase.Pending;
    this.#cancelled = true;
    this.#endedAt = now;
    return entered;
  }

  #changed(step: Step<TaskProgress>, now: Date): TaskChange | null {
    if (step.progress === this.#progress) return null;

    return this.#advance(step, now);
  }

  #advance(step: Step<TaskProgress>, now: Date): TaskChange {
    const pending = this.phase === Phase.Pending;
    const progress = step.progress;
    const ending = progress.ending();
    this.#progress = progress;

    if (step.retried) this.#retries += 1;

    if (ending !== null) this.#endedAt = now;

    const phase = this.phase;
    const entered = pending && phase !== Phase.Pending && phase !== null;
    return {
      starts: step.starts,
      entered,
      retried: step.retried,
      ending,
    };
  }
}
