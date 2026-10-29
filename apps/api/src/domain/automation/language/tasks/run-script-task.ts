import type {
  ParsedRunTask,
  ParsedScript,
  RunScriptTaskProps,
} from '../interfaces.js';
import type { Scope } from '../scope.js';
import { SupportedSubset } from '../supported-subset.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class RunScriptTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #language: string;
  readonly #script: Template | null;
  readonly #awaits: boolean;
  readonly #returns: string;

  constructor(props: RunScriptTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#language = props.language;
    this.#script = props.script;
    this.#awaits = props.awaits;
    this.#returns = props.returns;
  }

  static build(
    name: string,
    parsed: ParsedRunTask,
    script: ParsedScript,
    scope: Scope,
  ): RunScriptTask | null {
    const scriptAt = scope.at('run').at('script');
    const settings = TaskSettings.read(parsed, scope);
    const language = script.language;
    const accepted = SupportedSubset.acceptsScript(script, scriptAt);

    if (!accepted) return null;

    const template = Template.read(script, scriptAt);
    const awaits = parsed.run.await ?? true;
    const returns = parsed.run.return ?? 'stdout';
    return new RunScriptTask({
      name,
      reference: scope.pointer,
      settings,
      language,
      script: template,
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

  get language(): string {
    return this.#language;
  }

  get script(): Template | null {
    return this.#script;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): string {
    return this.#returns;
  }
}
