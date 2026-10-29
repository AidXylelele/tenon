import type {
  ParsedRunTask,
  ParsedShell,
  RunShellTaskProps,
} from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class RunShellTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #shell: Template | null;
  readonly #awaits: boolean;
  readonly #returns: string;

  constructor(props: RunShellTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#shell = props.shell;
    this.#awaits = props.awaits;
    this.#returns = props.returns;
  }

  static build(
    name: string,
    parsed: ParsedRunTask,
    shell: ParsedShell,
    scope: Scope,
  ): RunShellTask {
    const shellAt = scope.at('run').at('shell');
    const settings = TaskSettings.read(parsed, scope);
    const template = Template.read(shell, shellAt);
    const awaits = parsed.run.await ?? true;
    const returns = parsed.run.return ?? 'stdout';
    return new RunShellTask({
      name,
      reference: scope.pointer,
      settings,
      shell: template,
      awaits,
      returns,
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

  get shell(): Template | null {
    return this.#shell;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): string {
    return this.#returns;
  }
}
