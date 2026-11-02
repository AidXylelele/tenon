import { InconsistentProgressError } from '../../errors.js';
import { DueTime } from '../language/due-time.js';
import type { TaskStart } from '../language/interfaces.js';
import { DerivedId } from './derived-id.js';
import type { RequestedSubWorkflow } from './interfaces.js';
import { TaskInstance } from './task-instance.js';

// The instance's task executions and the tree their parent ids form. It keeps them by id and
// the running ones apart, so a pass costs what runs, not what ran.
export class TaskTree {
  // The default limit of task executions per instance (spec, Assumptions).
  static readonly #LIMIT = 10_000;
  static readonly #ORPHAN = 'a task other than the root runs inside its parent';

  readonly #instanceId: string;
  readonly #tasks: TaskInstance[];
  readonly #byId: Map<string, TaskInstance>;
  #running: TaskInstance[];
  #executions: number;

  constructor(
    instanceId: string,
    tasks: readonly TaskInstance[],
    executions: number,
  ) {
    this.#instanceId = instanceId;
    this.#tasks = [];
    this.#byId = new Map();
    this.#running = [];
    this.#executions = executions;

    for (const task of tasks) this.#add(task);
  }

  get tasks(): readonly TaskInstance[] {
    return this.#tasks;
  }

  get executions(): number {
    return this.#executions;
  }

  isFull(): boolean {
    return this.#executions >= TaskTree.#LIMIT;
  }

  // A copy, since following a change starts tasks while the caller goes through these.
  active(): readonly TaskInstance[] {
    this.#running = this.#running.filter((task) => !task.isTerminal());
    return this.#running.slice();
  }

  create(
    parentId: string | null,
    name: string,
    start: TaskStart,
    now: Date,
  ): TaskInstance {
    const execution = this.#executions;
    const counted = String(execution);
    const parts = [this.#instanceId, counted];
    const id = DerivedId.of(parts);
    const task = TaskInstance.create({
      id,
      execution,
      parentId,
      name,
      start,
      now,
    });
    this.#executions += 1;
    this.#add(task);
    return task;
  }

  parentOf(task: TaskInstance): TaskInstance {
    const parentId = task.parentId;

    if (parentId === null)
      throw new InconsistentProgressError(TaskTree.#ORPHAN);

    const parent = this.#byId.get(parentId);

    if (parent === undefined)
      throw new InconsistentProgressError(TaskTree.#ORPHAN);

    return parent;
  }

  // Depth first, the order in which abandoning them announces them.
  activeDescendantsOf(ancestor: TaskInstance): readonly TaskInstance[] {
    const found: TaskInstance[] = [];
    const pending: TaskInstance[] = [ancestor];

    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const children = this.#activeChildrenOf(next);

      for (const child of children) {
        found.push(child);
        pending.push(child);
      }
    }

    return found;
  }

  // The earliest deadline of the task and the tasks around it, the workflow's included.
  deadlineOf(task: TaskInstance): DueTime {
    let earliest = task.deadline();
    let current = task;

    while (!current.isRoot()) {
      current = this.parentOf(current);
      const enclosing = current.deadline();
      earliest = earliest.earlierOf(enclosing);
    }

    return earliest;
  }

  nextDue(): DueTime {
    let earliest = DueTime.None;

    for (const task of this.active()) {
      const due = task.nextDue();
      earliest = earliest.earlierOf(due);
    }

    return earliest;
  }

  requests(): readonly RequestedSubWorkflow[] {
    const requested: RequestedSubWorkflow[] = [];

    for (const task of this.active()) {
      const request = task.requestedSubWorkflow();

      if (request === null) continue;

      const instanceId = this.subWorkflowIdOf(task);
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

  requesting(subWorkflowId: string): TaskInstance | null {
    const task = this.active().find(
      (candidate) =>
        candidate.requestedSubWorkflow() !== null &&
        this.subWorkflowIdOf(candidate) === subWorkflowId,
    );
    return task ?? null;
  }

  subWorkflowIdOf(task: TaskInstance): string {
    const parts = [this.#instanceId, task.id];
    return DerivedId.of(parts);
  }

  #activeChildrenOf(parent: TaskInstance): readonly TaskInstance[] {
    const parentId = parent.id;
    return this.#running.filter(
      (task) => task.parentId === parentId && !task.isTerminal(),
    );
  }

  #add(task: TaskInstance): void {
    this.#tasks.push(task);
    this.#byId.set(task.id, task);

    if (!task.isTerminal()) this.#running.push(task);
  }
}
