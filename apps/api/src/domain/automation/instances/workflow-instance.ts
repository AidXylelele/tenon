import { randomUUID } from 'node:crypto';
import { InconsistentProgressError } from '../../errors.js';
import type { Event } from '../events/event.js';
import type { Definition } from '../language/definition.js';
import { ErrorType } from '../language/error-type.js';
import type { SubWorkflowAnswer } from '../language/answers/sub-workflow-answer.js';
import { SubWorkflowDetached } from '../language/answers/sub-workflow-detached.js';
import { SubWorkflowEnded } from '../language/answers/sub-workflow-ended.js';
import { SubWorkflowRefused } from '../language/answers/sub-workflow-refused.js';
import type {
  JsonObject,
  JsonValue,
  SubWorkflowEnding,
  TaskScopeProps,
  TaskStart,
} from '../language/interfaces.js';
import { JsonPointer } from '../language/json-pointer.js';
import type { Outcome } from '../language/outcome.js';
import { Phase } from '../language/phase.js';
import { RoundResults } from '../language/round-results.js';
import { RoundWork } from '../language/round-work.js';
import { TaskScope } from '../language/scopes/task-scope.js';
import { WorkflowScope } from '../language/scopes/workflow-scope.js';
import type { TaskEnding } from '../language/task-ending.js';
import type { Task } from '../language/tasks/task.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type { WorkflowName } from '../language/workflow-name.js';
import type { Workflow } from '../workflows/workflow.js';
import type { WorkflowVersion } from '../workflows/workflow-version.js';
import { DerivedId } from './derived-id.js';
import { ProcessDetached } from './domain-events/process-detached.js';
import { WorkflowDetached } from './domain-events/workflow-detached.js';
import { InstanceProgressKind } from './enums.js';
import type {
  InstanceEvent,
  InstanceIdentity,
  InstanceProgress,
  NewSubWorkflowInstance,
  NewWorkflowInstance,
  Origin,
  RequestedSubWorkflow,
  RoundContext,
  TaskChange,
  TaskFollowUp,
  WorkflowInstanceProps,
} from './interfaces.js';
import { LifecycleEventType } from './lifecycle-event-type.js';
import { ParentOrigin } from './origins/parent-origin.js';
import { ProducedEvents } from './produced-events.js';
import { TaskInstance } from './task-instance.js';

export class WorkflowInstance {
  static readonly #RUN_FAILED = 'The run of the instance failed';
  // The default limit of task executions per instance (spec, Assumptions).
  static readonly #EXECUTION_LIMIT = 10_000;
  static readonly #LIMIT_REACHED =
    'The instance reached its limit of 10,000 task executions';
  static readonly #NOT_NAMED = 'The workflow is not the one the run task names';

  readonly #id: string;
  readonly #workflowId: string;
  readonly #versionId: string;
  readonly #workflow: WorkflowName;
  readonly #semver: string;
  readonly #input: JsonValue;
  readonly #origin: Origin;
  readonly #startedAt: Date;
  readonly #version: number;
  readonly #tasks: TaskInstance[];
  // Lookups by id and the tasks still running, so a pass costs what runs, not what ran.
  readonly #byId: Map<string, TaskInstance>;
  #running: TaskInstance[];
  readonly #produced: ProducedEvents;
  readonly #events: InstanceEvent[];
  #phase: Phase;
  #output: JsonValue;
  #error: WorkflowError | null;
  #context: JsonValue;
  #endedAt: Date | null;
  #executions: number;
  #changed: boolean;

  constructor(props: WorkflowInstanceProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#versionId = props.versionId;
    this.#workflow = props.workflow;
    this.#semver = props.semver;
    this.#phase = props.phase;
    this.#input = props.input;
    this.#output = props.output;
    this.#error = props.error;
    this.#context = props.context;
    this.#origin = props.origin;
    this.#startedAt = props.startedAt;
    this.#endedAt = props.endedAt;
    this.#executions = props.executions;
    this.#tasks = props.tasks.slice();
    this.#byId = new Map();
    this.#running = [];

    for (const task of this.#tasks) this.#index(task);

    this.#version = props.version;
    this.#events = [];
    this.#changed = false;
    this.#produced = new ProducedEvents(
      {
        instanceId: props.id,
        workflowId: props.workflowId,
        workflow: props.workflow,
        semver: props.semver,
      },
      props.sequence,
    );
  }

  static idFor(identity: InstanceIdentity): string {
    if (identity.key === null) return randomUUID();

    const parts = [identity.userId, identity.workflowId, identity.key];
    return DerivedId.of(parts);
  }

  static start(input: NewWorkflowInstance): WorkflowInstance {
    const workflow = input.workflow;
    const version = input.version;

    if (version.workflowId !== workflow.id)
      throw new TypeError('The version belongs to another workflow');

    const instance = new WorkflowInstance({
      id: input.id,
      workflowId: workflow.id,
      versionId: version.id,
      workflow: workflow.name,
      semver: version.semver,
      phase: Phase.Pending,
      input: input.input ?? {},
      output: null,
      error: null,
      context: {},
      origin: input.origin,
      startedAt: input.now,
      endedAt: null,
      sequence: 0,
      executions: 0,
      tasks: [],
      version: 0,
    });
    instance.#changed = true;
    return instance;
  }

  static startSubWorkflow(input: NewSubWorkflowInstance): WorkflowInstance {
    const origin = new ParentOrigin(input.parentId, input.taskId);
    return WorkflowInstance.start({
      id: input.id,
      workflow: input.workflow,
      version: input.version,
      input: input.input,
      origin,
      now: input.now,
    });
  }

  get id(): string {
    return this.#id;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get versionId(): string {
    return this.#versionId;
  }

  get workflow(): WorkflowName {
    return this.#workflow;
  }

  get semver(): string {
    return this.#semver;
  }

  get phase(): Phase {
    return this.#phase;
  }

  get input(): JsonValue {
    return this.#input;
  }

  get output(): JsonValue {
    return this.#output;
  }

  get error(): WorkflowError | null {
    return this.#error;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get origin(): Origin {
    return this.#origin;
  }

  get startedAt(): Date {
    return this.#startedAt;
  }

  get endedAt(): Date | null {
    return this.#endedAt;
  }

  get sequence(): number {
    return this.#produced.sequence;
  }

  get executions(): number {
    return this.#executions;
  }

  get tasks(): readonly TaskInstance[] {
    return this.#tasks;
  }

  get version(): number {
    return this.#version;
  }

  get changed(): boolean {
    return this.#changed;
  }

  beginRound(definition: Definition, runtime: JsonObject, now: Date): void {
    if (this.#phase.isTerminal()) return;

    const round = this.#round(definition, runtime, now);

    if (this.#phase === Phase.Pending) this.#run(round);

    for (const task of this.#activeTasks()) this.#fire(task, round);

    this.#settle(round);
  }

  pendingWork(
    definition: Definition,
    runtime: JsonObject,
    now: Date,
  ): RoundWork {
    if (this.#phase.isTerminal()) return RoundWork.none();

    const round = this.#round(definition, runtime, now);
    const works: RoundWork[] = [];
    let exporting = false;

    // One export per pass, so each sees the context the one before it left (fork branches
    // that end together would otherwise overwrite one another's exports).
    for (const task of this.#activeTasks()) {
      const exports = task.exportsContext();

      if (exports && exporting) continue;

      if (exports) exporting = true;

      const scope = this.#scopeOf(task, round);
      const work = task.work(scope);
      works.push(work);
    }

    return RoundWork.combined(works);
  }

  record(
    results: RoundResults,
    definition: Definition,
    runtime: JsonObject,
    now: Date,
  ): void {
    if (this.#phase.isTerminal()) return;

    const round = this.#round(definition, runtime, now);

    for (const task of this.#activeTasks()) {
      const scope = this.#scopeOf(task, round);
      const change = task.record(results, scope);
      this.#follow(task, change, round);
    }

    // The results arrived at `now`: a task whose time ran out meanwhile, or around whose
    // work the workflow's did, is interrupted, as the standard's timeouts require.
    for (const task of this.#activeTasks()) this.#expire(task, round);

    this.#settle(round);
  }

  fault(now: Date): void {
    if (this.#phase.isTerminal()) return;

    const root = JsonPointer.root();
    const error = ErrorType.Runtime.errorAt(root, WorkflowInstance.#RUN_FAILED);
    this.#faultWith(error, now);
  }

  #faultWith(error: WorkflowError, now: Date): void {
    for (const task of this.#activeTasks()) this.#abandon(task, now);

    this.#end(Phase.Faulted, now);
    this.#error = error;
    this.#produced.announce(
      {
        type: LifecycleEventType.WorkflowFaulted,
        task: null,
        time: now,
        error,
        output: null,
      },
      now,
    );
  }

  requestedSubWorkflows(): readonly RequestedSubWorkflow[] {
    const requested: RequestedSubWorkflow[] = [];

    for (const task of this.#activeTasks()) {
      const request = task.requestedSubWorkflow();

      if (request === null) continue;

      const instanceId = this.#subWorkflowIdOf(task);
      requested.push({
        taskId: task.id,
        instanceId,
        target: request.target,
        input: request.input,
        awaited: request.awaited,
      });
    }

    return requested;
  }

  requestedSubWorkflow(instanceId: string): RequestedSubWorkflow | null {
    const requested = this.requestedSubWorkflows();
    const request = requested.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    return request ?? null;
  }

  answerSubWorkflow(
    instanceId: string,
    workflow: Workflow | null,
    version: WorkflowVersion | null,
    definition: Definition,
    runtime: JsonObject,
    now: Date,
  ): WorkflowInstance | null {
    const request = this.requestedSubWorkflow(instanceId);
    const task = this.#requesting(instanceId);

    if (this.#phase.isTerminal() || request === null || task === null)
      return null;

    const round = this.#round(definition, runtime, now);

    if (workflow === null || version === null) {
      const refused = new SubWorkflowRefused();
      this.#answer(task, refused, round);
      return null;
    }

    const named = request.target.workflow.equals(workflow.name);

    if (!named) throw new TypeError(WorkflowInstance.#NOT_NAMED);

    if (!request.awaited) {
      const detached = new SubWorkflowDetached({
        workflow: workflow.name,
        versionId: version.id,
        input: request.input,
      });
      this.#answer(task, detached, round);
      return null;
    }

    return WorkflowInstance.startSubWorkflow({
      id: request.instanceId,
      parentId: this.#id,
      taskId: request.taskId,
      workflow,
      version,
      input: request.input,
      now,
    });
  }

  completeSubWorkflow(
    instanceId: string,
    ending: SubWorkflowEnding | null,
    definition: Definition,
    runtime: JsonObject,
    now: Date,
  ): void {
    const task = this.#requesting(instanceId);

    if (this.#phase.isTerminal() || task === null) return;

    const round = this.#round(definition, runtime, now);
    const ended = new SubWorkflowEnded(ending);
    this.#answer(task, ended, round);
  }

  progress(now: Date): InstanceProgress {
    const none: readonly string[] = [];

    if (this.#phase.isTerminal())
      return {
        kind: InstanceProgressKind.Ended,
        wakeAt: null,
        subWorkflows: none,
      };

    const requested = this.requestedSubWorkflows();
    const subWorkflows = requested.map((request) => request.instanceId);
    const wakeAt = this.#earliestWake();
    const due = wakeAt !== null && wakeAt <= now;

    if (this.#phase === Phase.Waiting && !due)
      return { kind: InstanceProgressKind.Park, wakeAt, subWorkflows };

    return { kind: InstanceProgressKind.Run, wakeAt, subWorkflows };
  }

  takeProducedEvents(): readonly Event[] {
    return this.#produced.take();
  }

  takeDomainEvents(): readonly InstanceEvent[] {
    return this.#events.splice(0);
  }

  #round(definition: Definition, runtime: JsonObject, now: Date): RoundContext {
    const own =
      definition.workflow.equals(this.#workflow) &&
      definition.version === this.#semver;

    if (!own)
      throw new TypeError(
        'The definition is not the version the instance runs',
      );

    return { definition, runtime, now };
  }

  #run(round: RoundContext): void {
    this.#phase = Phase.Running;
    this.#changed = true;
    this.#produced.announce(
      {
        type: LifecycleEventType.WorkflowStarted,
        task: null,
        time: this.#startedAt,
        error: null,
        output: null,
      },
      round.now,
    );
    const variables: JsonObject = {};
    const start: TaskStart = {
      reference: round.definition.root.reference,
      input: this.#input,
      variables,
    };
    const root = this.#created(null, start, round);
    const scope = this.#scopeOf(root, round);
    const change = root.begin(scope);
    this.#follow(root, change, round);
  }

  #fire(task: TaskInstance, round: RoundContext): void {
    const expired = this.#expire(task, round);

    if (expired || !task.isDue(round.now)) return;

    const scope = this.#scopeOf(task, round);
    const none = RoundResults.none();
    const resumed = task.record(none, scope);
    this.#follow(task, resumed, round);
  }

  #expire(task: TaskInstance, round: RoundContext): boolean {
    if (task.isTerminal() || !task.hasElapsed(round.now)) return false;

    const scope = this.#scopeOf(task, round);
    const timedOut = task.timeOut(scope);
    this.#follow(task, timedOut, round);
    return true;
  }

  #answer(
    task: TaskInstance,
    answer: SubWorkflowAnswer,
    round: RoundContext,
  ): void {
    const scope = this.#scopeOf(task, round);
    const change = task.subWorkflowAnswered(answer, scope);
    this.#follow(task, change, round);
    this.#settle(round);
  }

  #follow(
    task: TaskInstance,
    change: TaskChange | null,
    round: RoundContext,
  ): void {
    if (change === null) return;

    this.#changed = true;
    const queue: TaskFollowUp[] = [];
    this.#accept(task, change, queue, round.now);

    for (let next = queue.shift(); next !== undefined; next = queue.shift())
      this.#followUp(next, queue, round);
  }

  #accept(
    task: TaskInstance,
    change: TaskChange,
    queue: TaskFollowUp[],
    now: Date,
  ): void {
    if (change.entered) {
      this.#announceTask(
        LifecycleEventType.TaskCreated,
        task,
        task.startedAt,
        now,
      );
      this.#announceTask(
        LifecycleEventType.TaskStarted,
        task,
        task.startedAt,
        now,
      );
    }

    if (change.retried)
      this.#announceTask(LifecycleEventType.TaskRetried, task, now, now);

    queue.push({ task, change });
  }

  #followUp(
    followUp: TaskFollowUp,
    queue: TaskFollowUp[],
    round: RoundContext,
  ): void {
    const task = followUp.task;
    const change = followUp.change;

    if (task.isCancelled()) return;

    for (const start of change.starts) {
      const spent = this.#executions >= WorkflowInstance.#EXECUTION_LIMIT;

      if (spent) {
        const error = ErrorType.Runtime.errorAt(
          task.reference,
          WorkflowInstance.#LIMIT_REACHED,
        );
        this.#faultWith(error, round.now);
        return;
      }

      const child = this.#created(task.id, start, round);
      const scope = this.#scopeOf(child, round);
      const begun = child.begin(scope);
      this.#accept(child, begun, queue, round.now);
    }

    if (!task.runsBody()) this.#abandonChildrenOf(task, round.now);

    const ending = change.ending;

    if (ending === null) return;

    this.#ended(task, ending, round.now);

    if (task.isRoot()) {
      this.#conclude(ending, round.now);
      return;
    }

    const parent = this.#parentOf(task);
    const scope = this.#scopeOf(parent, round);
    const parentChange = parent.childEnded(task.reference, ending, scope);

    if (parentChange !== null)
      this.#accept(parent, parentChange, queue, round.now);
  }

  #ended(task: TaskInstance, ending: TaskEnding, now: Date): void {
    if (ending.skipped) return;

    const body = ending.body;

    if (body !== null) this.#act(task, body, now);

    if (ending.exported) this.#context = ending.context;

    if (task.isRoot()) return;

    const failure = ending.failure;

    if (failure !== null) {
      this.#produced.announce(
        {
          type: LifecycleEventType.TaskFaulted,
          task: task.reference,
          time: now,
          error: failure,
          output: null,
        },
        now,
      );
      return;
    }

    this.#produced.announce(
      {
        type: LifecycleEventType.TaskCompleted,
        task: task.reference,
        time: now,
        error: null,
        output: { value: ending.output },
      },
      now,
    );
  }

  #act(task: TaskInstance, body: Outcome, now: Date): void {
    const emitted = body.emitted;
    const run = body.detachedProcess;
    const detachedWorkflow = body.detachedWorkflow;

    if (emitted !== null) this.#produced.emit(emitted, now);

    if (run !== null) {
      const detached = new ProcessDetached({
        instanceId: this.#id,
        taskInstanceId: task.id,
        run,
      });
      this.#events.push(detached);
    }

    if (detachedWorkflow !== null) {
      const subWorkflowId = this.#subWorkflowIdOf(task);
      const detached = new WorkflowDetached({
        instanceId: this.#id,
        taskInstanceId: task.id,
        subWorkflowId,
        detached: detachedWorkflow,
      });
      this.#events.push(detached);
    }
  }

  #conclude(ending: TaskEnding, now: Date): void {
    const failure = ending.failure;

    if (failure !== null) {
      this.#end(Phase.Faulted, now);
      this.#error = failure;
      this.#produced.announce(
        {
          type: LifecycleEventType.WorkflowFaulted,
          task: null,
          time: now,
          error: failure,
          output: null,
        },
        now,
      );
      return;
    }

    this.#end(Phase.Completed, now);
    this.#output = ending.output;
    this.#produced.announce(
      {
        type: LifecycleEventType.WorkflowCompleted,
        task: null,
        time: now,
        error: null,
        output: { value: ending.output },
      },
      now,
    );
  }

  #end(phase: Phase, now: Date): void {
    this.#phase = phase;
    this.#endedAt = now;
    this.#changed = true;
  }

  #settle(round: RoundContext): void {
    if (this.#phase.isTerminal()) return;

    const work = this.pendingWork(round.definition, round.runtime, round.now);

    if (work.isEmpty()) {
      this.#become(Phase.Waiting);
      return;
    }

    this.#become(Phase.Running);
  }

  #become(phase: Phase): void {
    if (phase === this.#phase) return;

    this.#phase = phase;
    this.#changed = true;
  }

  #abandonChildrenOf(parent: TaskInstance, now: Date): void {
    const pending: TaskInstance[] = [parent];

    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const parentId = next.id;
      const children = this.#activeTasks().filter(
        (task) => task.parentId === parentId,
      );

      for (const child of children) {
        this.#abandon(child, now);
        pending.push(child);
      }
    }
  }

  #abandon(task: TaskInstance, now: Date): void {
    const announced = task.abandon(now);

    if (announced)
      this.#announceTask(LifecycleEventType.TaskCancelled, task, now, now);
  }

  #announceTask(
    type: LifecycleEventType,
    task: TaskInstance,
    at: Date,
    now: Date,
  ): void {
    if (task.isRoot()) return;

    this.#produced.announce(
      {
        type,
        task: task.reference,
        time: at,
        error: null,
        output: null,
      },
      now,
    );
  }

  #created(
    parentId: string | null,
    start: TaskStart,
    round: RoundContext,
  ): TaskInstance {
    const execution = this.#executions;
    const counted = String(execution);
    const parts = [this.#id, counted];
    const id = DerivedId.of(parts);
    const name = round.definition.taskAt(start.reference).name;
    const task = TaskInstance.create({
      id,
      execution,
      parentId,
      name,
      start,
      now: round.now,
    });
    this.#executions += 1;
    this.#tasks.push(task);
    this.#index(task);
    return task;
  }

  #index(task: TaskInstance): void {
    this.#byId.set(task.id, task);

    if (!task.isTerminal()) this.#running.push(task);
  }

  #scopeOf(task: TaskInstance, round: RoundContext): TaskScope {
    const definition = round.definition;

    if (task.isRoot()) {
      const rootProps = this.#scopePropsOf(definition.root, task, round);
      return new WorkflowScope(rootProps);
    }

    const declared = definition.taskAt(task.reference);
    const props = this.#scopePropsOf(declared, task, round);
    return new TaskScope(props);
  }

  #scopePropsOf<T extends Task>(
    declared: T,
    task: TaskInstance,
    round: RoundContext,
  ): TaskScopeProps<T> {
    return {
      id: task.id,
      task: declared,
      definition: round.definition,
      rawInput: task.rawInput,
      context: this.#context,
      instanceId: this.#id,
      workflowInput: this.#input,
      workflowStartedAt: this.#startedAt,
      runtime: round.runtime,
      variables: task.variables,
      startedAt: task.startedAt,
      deadline: this.#deadlineOf(task),
      now: round.now,
    };
  }

  #deadlineOf(task: TaskInstance): Date | null {
    let earliest = task.deadline();
    let current = task;

    while (!current.isRoot()) {
      current = this.#parentOf(current);
      const deadline = current.deadline();
      const earlier =
        deadline !== null && (earliest === null || deadline < earliest);

      if (earlier) earliest = deadline;
    }

    return earliest;
  }

  // A copy, since following a change starts tasks while the caller goes through these.
  #activeTasks(): readonly TaskInstance[] {
    this.#running = this.#running.filter((task) => !task.isTerminal());
    return this.#running.slice();
  }

  #parentOf(task: TaskInstance): TaskInstance {
    const parentId = task.parentId ?? '';
    const parent = this.#byId.get(parentId);

    if (parent === undefined)
      throw new InconsistentProgressError(
        'a task other than the root runs inside its parent',
      );

    return parent;
  }

  #requesting(instanceId: string): TaskInstance | null {
    const task = this.#activeTasks().find(
      (candidate) =>
        candidate.requestedSubWorkflow() !== null &&
        this.#subWorkflowIdOf(candidate) === instanceId,
    );
    return task ?? null;
  }

  #subWorkflowIdOf(task: TaskInstance): string {
    const parts = [this.#id, task.id];
    return DerivedId.of(parts);
  }

  #earliestWake(): Date | null {
    let earliest: Date | null = null;

    for (const task of this.#activeTasks()) {
      const wakeAt = task.wakeAt();

      if (wakeAt !== null && (earliest === null || wakeAt < earliest))
        earliest = wakeAt;
    }

    return earliest;
  }
}
