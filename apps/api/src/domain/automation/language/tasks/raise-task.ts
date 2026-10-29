import type { ParsedRaiseTask, RaiseTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class RaiseTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #error: Template;

  constructor(props: RaiseTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#error = props.error;
  }

  static build(
    name: string,
    parsed: ParsedRaiseTask,
    scope: Scope,
  ): RaiseTask | null {
    const errorAt = scope.at('raise').at('error');
    const settings = TaskSettings.read(parsed, scope);
    const declared = parsed.raise.error;
    const named = typeof declared === 'string';
    const error = named
      ? scope.components.error(declared, errorAt)
      : Template.read(declared, errorAt);

    if (error === null) return null;

    return new RaiseTask({ name, reference: scope.pointer, settings, error });
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

  get error(): Template {
    return this.#error;
  }
}
