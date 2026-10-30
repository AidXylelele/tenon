import { DuplicateTaskError } from '../../errors.js';
import type { Expression } from './expression.js';
import type { TaskListProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { ReusableComponents } from './reusable-components.js';
import type { Task } from './task.js';

export class TaskList {
  readonly #reference: JsonPointer;
  readonly #tasks: readonly Task[];

  constructor(props: TaskListProps) {
    const names = this.#namesOf(props.tasks);
    this.#confirmDirectives(props.tasks, names);
    this.#reference = props.reference;
    this.#tasks = props.tasks;
  }

  get reference(): JsonPointer {
    return this.#reference;
  }

  get tasks(): readonly Task[] {
    return this.#tasks;
  }

  get expressions(): readonly Expression[] {
    const found: Expression[] = [];

    for (const task of this.#tasks)
      for (const expression of task.expressions) found.push(expression);

    return found;
  }

  isEmpty(): boolean {
    return this.#tasks.length === 0;
  }

  confirmCalls(components: ReusableComponents): void {
    for (const task of this.#tasks) task.confirmCalls(components);
  }

  #namesOf(tasks: readonly Task[]): ReadonlySet<string> {
    const names = new Set<string>();

    for (const task of tasks) {
      const duplicate = names.has(task.name);

      if (duplicate) throw new DuplicateTaskError(task.name, task.reference);

      names.add(task.name);
    }

    return names;
  }

  #confirmDirectives(tasks: readonly Task[], names: ReadonlySet<string>): void {
    for (const task of tasks)
      for (const directive of task.directives) directive.confirmWithin(names);
  }
}
