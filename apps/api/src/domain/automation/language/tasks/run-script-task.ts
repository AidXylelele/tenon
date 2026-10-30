import { ProcessReturn, type ScriptLanguage } from '../enums.js';
import type { Expression } from '../expression.js';
import type { RunScriptTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class RunScriptTask extends Task {
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

  get script(): Template {
    return this.#script;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): ProcessReturn {
    return this.#returns;
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#script.expressions;
  }
}
