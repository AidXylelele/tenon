import { RunKind, type ScriptLanguage } from '../enums.js';
import type {
  JsonValue,
  ProcessRun,
  RunScriptTaskProps,
} from '../interfaces.js';
import { ProcessTask } from './process-task.js';
import type { Template } from '../template.js';

export class RunScriptTask extends ProcessTask {
  readonly #language: ScriptLanguage;
  readonly #script: Template;

  constructor(props: RunScriptTaskProps) {
    super(props);
    this.#language = props.language;
    this.#script = props.script;
  }

  get language(): ScriptLanguage {
    return this.#language;
  }

  get process(): Template {
    return this.#script;
  }

  protected runFrom(
    id: string,
    process: JsonValue,
    deadline: Date | null,
  ): ProcessRun {
    return {
      id,
      kind: RunKind.Script,
      language: this.#language,
      process,
      deadline,
    };
  }
}
