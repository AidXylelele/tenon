import type { ParsedDoTask, DoTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskList } from '../task-list.js';
import { TaskSettings } from '../task-settings.js';

export class DoTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #body: TaskList;

  constructor(props: DoTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#body = props.body;
  }

  static build(name: string, parsed: ParsedDoTask, scope: Scope): DoTask {
    const bodyAt = scope.at('do');
    const settings = TaskSettings.read(parsed, scope);
    const body = TaskList.build(parsed.do, bodyAt);
    return new DoTask({ name, reference: scope.pointer, settings, body });
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

  get body(): TaskList {
    return this.#body;
  }
}
