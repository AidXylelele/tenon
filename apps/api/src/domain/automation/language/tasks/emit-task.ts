import type { ParsedEmitTask, EmitTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class EmitTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #event: Template | null;

  constructor(props: EmitTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#event = props.event;
  }

  static build(name: string, parsed: ParsedEmitTask, scope: Scope): EmitTask {
    const eventAt = scope.at('emit').at('event').at('with');
    const settings = TaskSettings.read(parsed, scope);
    const event = Template.read(parsed.emit.event.with, eventAt);
    return new EmitTask({ name, reference: scope.pointer, settings, event });
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

  get event(): Template | null {
    return this.#event;
  }
}
