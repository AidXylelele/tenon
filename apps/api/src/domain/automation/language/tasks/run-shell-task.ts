import { RunKind } from '../enums.js';
import type { Expression } from '../expression.js';
import type {
  JsonValue,
  ProcessRun,
  ProcessTask,
  RunShellTaskProps,
} from '../interfaces.js';
import { ProcessReturn } from '../process-return.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { ProcessProgress } from '../progress/process-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class RunShellTask extends Task implements ProcessTask {
  readonly #shell: Template;
  readonly #awaits: boolean;
  readonly #returns: ProcessReturn;

  constructor(props: RunShellTaskProps) {
    super(props);
    this.#shell = props.shell;
    this.#awaits = props.awaits ?? true;
    this.#returns = props.returns ?? ProcessReturn.Stdout;
  }

  get process(): Template {
    return this.#shell;
  }

  get awaits(): boolean {
    return this.#awaits;
  }

  get returns(): ProcessReturn {
    return this.#returns;
  }

  enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    return ProcessProgress.enter(input, scope);
  }

  runFrom(id: string, process: JsonValue): ProcessRun {
    return { id, kind: RunKind.Shell, language: null, process };
  }

  protected override get ownExpressions(): readonly Expression[] {
    return this.#shell.expressions;
  }
}
