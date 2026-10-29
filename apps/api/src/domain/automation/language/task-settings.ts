import { DataSpec } from './data-spec.js';
import { type Duration, DurationFactory } from './duration-factory.js';
import { Expression } from './expression.js';
import { FlowDirective } from './flow-directive.js';
import type { ParsedTaskBase, TaskSettingsProps } from './interfaces.js';
import type { Scope } from './scope.js';

export class TaskSettings {
  readonly #condition: Expression | null;
  readonly #input: DataSpec;
  readonly #output: DataSpec;
  readonly #export: DataSpec;
  readonly #timeout: Duration | null;
  readonly #then: FlowDirective;

  constructor(props: TaskSettingsProps) {
    this.#condition = props.condition;
    this.#input = props.input;
    this.#output = props.output;
    this.#export = props.export;
    this.#timeout = props.timeout;
    this.#then = props.then;
  }

  static read(parsed: ParsedTaskBase, scope: Scope): TaskSettings {
    const conditionAt = scope.at('if');
    const inputAt = scope.at('input');
    const outputAt = scope.at('output');
    const exportAt = scope.at('export');
    const timeoutAt = scope.at('timeout');
    const thenAt = scope.at('then');
    const condition = Expression.read(parsed.if, conditionAt);
    const input = DataSpec.input(parsed.input, inputAt);
    const output = DataSpec.output(parsed.output, outputAt);
    const exportSpec = DataSpec.output(parsed.export, exportAt);
    const timeout = DurationFactory.timeout(parsed.timeout, timeoutAt);
    const then = FlowDirective.read(parsed.then, thenAt);
    return new TaskSettings({
      condition,
      input,
      output,
      export: exportSpec,
      timeout,
      then,
    });
  }

  get condition(): Expression | null {
    return this.#condition;
  }

  get input(): DataSpec {
    return this.#input;
  }

  get output(): DataSpec {
    return this.#output;
  }

  get export(): DataSpec {
    return this.#export;
  }

  get timeout(): Duration | null {
    return this.#timeout;
  }

  get then(): FlowDirective {
    return this.#then;
  }
}
