import { RunKind, type ScriptLanguage } from '../enums.js';
import type { Expression } from '../expression.js';
import type {
  JsonValue,
  ProcessRun,
  ProcessTask,
  RunScriptTaskProps,
} from '../interfaces.js';
import { ProcessReturn } from '../process-return.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ProcessProgress } from '../progress/process-progress.js';
import type { Step } from '../step.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class RunScriptTask extends Task implements ProcessTask {
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

  enter(scope: BodyScope): Step<KindProgress> {
    return ProcessProgress.enter(scope);
  }

  runFrom(id: string, process: JsonValue): ProcessRun {
    return { id, kind: RunKind.Script, language: this.#language, process };
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#script.expressions;
  }
}
