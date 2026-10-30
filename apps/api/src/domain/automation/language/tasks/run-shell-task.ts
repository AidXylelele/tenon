import { ProcessReturn } from '../enums.js';
import type { Expression } from '../expression.js';
import type { RunShellTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class RunShellTask extends Task {
  readonly #shell: Template;
  readonly #awaits: boolean;
  readonly #returns: ProcessReturn;

  constructor(props: RunShellTaskProps) {
    super(props);
    this.#shell = props.shell;
    this.#awaits = props.awaits ?? true;
    this.#returns = props.returns ?? ProcessReturn.Stdout;
  }

  get shell(): Template {
    return this.#shell;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): ProcessReturn {
    return this.#returns;
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#shell.expressions;
  }
}
