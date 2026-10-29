import type { ParsedForkTask, ForkTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskList } from '../task-list.js';
import { TaskSettings } from '../task-settings.js';

export class ForkTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #branches: TaskList;
  readonly #compete: boolean;

  constructor(props: ForkTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#branches = props.branches;
    this.#compete = props.compete;
  }

  static build(name: string, parsed: ParsedForkTask, scope: Scope): ForkTask {
    const branchesAt = scope.at('fork').at('branches');
    const settings = TaskSettings.read(parsed, scope);
    const branches = TaskList.build(parsed.fork.branches, branchesAt);
    const compete = parsed.fork.compete ?? false;
    const empty = branches.isEmpty();

    if (empty) branchesAt.refuse('A fork needs at least one branch');

    return new ForkTask({
      name,
      reference: scope.pointer,
      settings,
      branches,
      compete,
    });
  }

  get name(): string {
    return this.#name;
  }

  get reference(): string {
    return this.#reference;
  }

  get settings(): TaskSettings {
    return this.#settings;
  }

  get branches(): TaskList {
    return this.#branches;
  }

  get compete(): boolean {
    return this.#compete;
  }
}
