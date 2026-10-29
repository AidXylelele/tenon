import type { ParsedSetTask, SetTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class SetTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #value: Template | null;

  constructor(props: SetTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#value = props.value;
  }

  static build(name: string, parsed: ParsedSetTask, scope: Scope): SetTask {
    const valueAt = scope.at('set');
    const settings = TaskSettings.read(parsed, scope);
    const value = Template.read(parsed.set, valueAt);
    return new SetTask({ name, reference: scope.pointer, settings, value });
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

  get value(): Template | null {
    return this.#value;
  }
}
