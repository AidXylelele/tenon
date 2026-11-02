import { RunKind, type ScriptLanguage } from '../enums.js';
import type {
  JsonValue,
  ProcessRun,
  RunScriptTaskProps,
} from '../interfaces.js';
import { ProcessReturn } from '../process-return.js';
import { ProcessTask } from './process-task.js';
import type { Template } from '../template.js';

export class RunScriptTask extends ProcessTask {
  readonly #language: ScriptLanguage;
  readonly #script: Template;
  readonly #awaits: boolean;
  readonly #returns: ProcessReturn;

  constructor(props: RunScriptTaskProps) {
    super(props);
    this.#language = props.language;
    this.#script = props.script;
    this.#awaits = props.awaits ?? true;
    this.#returns = props.returns ?? ProcessReturn.Stdout;
  }

  get language(): ScriptLanguage {
    return this.#language;
  }

  get process(): Template {
    return this.#script;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): ProcessReturn {
    return this.#returns;
  }

  runFrom(id: string, process: JsonValue, deadline: Date | null): ProcessRun {
    return {
      id,
      kind: RunKind.Script,
      language: this.#language,
      process,
      deadline,
    };
  }
}
