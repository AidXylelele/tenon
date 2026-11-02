import { RunKind } from '../enums.js';
import type {
  JsonValue,
  ProcessRun,
  RunShellTaskProps,
} from '../interfaces.js';
import { ProcessReturn } from '../process-return.js';
import { ProcessTask } from './process-task.js';
import type { Template } from '../template.js';

export class RunShellTask extends ProcessTask {
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

  runFrom(id: string, process: JsonValue, deadline: Date | null): ProcessRun {
    return { id, kind: RunKind.Shell, language: null, process, deadline };
  }
}
