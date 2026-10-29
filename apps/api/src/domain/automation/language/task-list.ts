import type { ParsedTaskList } from './interfaces.js';
import type { Scope } from './scope.js';
import type { Task } from './task.js';
import { TaskFactory } from './task-factory.js';

export class TaskList {
  readonly #pointer: string;
  readonly #tasks: readonly Task[];

  constructor(pointer: string, tasks: readonly Task[]) {
    this.#pointer = pointer;
    this.#tasks = tasks;
  }

  static build(parsed: ParsedTaskList, scope: Scope): TaskList {
    const names = new Set<string>();

    parsed.forEach((item, index) => {
      for (const name of Object.keys(item)) {
        const duplicate = names.has(name);

        if (duplicate)
          scope
            .at(index)
            .at(name)
            .refuse(`Another task in this list is named "${name}"`);

        names.add(name);
      }
    });

    const listed = scope.within(names);
    const tasks: Task[] = [];

    parsed.forEach((item, index) => {
      for (const name of Object.keys(item)) {
        const parsedTask = item[name];

        if (parsedTask === undefined) continue;

        const taskAt = listed.at(index).at(name);
        const task = TaskFactory.build(name, parsedTask, taskAt);

        if (task !== null) tasks.push(task);
      }
    });

    return new TaskList(scope.pointer, tasks);
  }

  static read(
    parsed: ParsedTaskList | undefined,
    scope: Scope,
  ): TaskList | null {
    if (parsed === undefined) return null;

    return TaskList.build(parsed, scope);
  }

  get pointer(): string {
    return this.#pointer;
  }

  get tasks(): readonly Task[] {
    return this.#tasks;
  }

  isEmpty(): boolean {
    return this.#tasks.length === 0;
  }
}
