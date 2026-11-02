import { RunKind } from '../enums.js';
import type {
  JsonValue,
  ProcessRun,
  RunShellTaskProps,
} from '../interfaces.js';
import { ProcessTask } from './process-task.js';
import type { Template } from '../template.js';

export class RunShellTask extends ProcessTask {
  readonly #shell: Template;

  constructor(props: RunShellTaskProps) {
    super(props);
    this.#shell = props.shell;
  }

  get process(): Template {
    return this.#shell;
  }

  protected runFrom(
    id: string,
    process: JsonValue,
    deadline: Date | null,
  ): ProcessRun {
    return { id, kind: RunKind.Shell, language: null, process, deadline };
  }
}
