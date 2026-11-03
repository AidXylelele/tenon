import type { Specification } from '@openworkflowspec/sdk';
import type { JsonPointer } from './json-pointer.js';

// A task where it sits in its document: its pointer, its name and the list it belongs to
// (null for a function declared in `use.functions`).
export class LocatedTask {
  readonly #pointer: JsonPointer;
  readonly #name: string;
  readonly #task: Specification.Task;
  readonly #list: Specification.TaskList | null;

  constructor(
    pointer: JsonPointer,
    name: string,
    task: Specification.Task,
    list: Specification.TaskList | null,
  ) {
    this.#pointer = pointer;
    this.#name = name;
    this.#task = task;
    this.#list = list;
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  get name(): string {
    return this.#name;
  }

  get task(): Specification.Task {
    return this.#task;
  }

  get list(): Specification.TaskList | null {
    return this.#list;
  }
}
