import type { Export } from './export.js';
import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { FlowDirective } from './flow-directive.js';
import type { Input } from './input.js';
import type { TaskBaseProps } from './interfaces.js';
import type { Output } from './output.js';

export class TaskBase {
  readonly #condition: Expression | null;
  readonly #input: Input;
  readonly #output: Output;
  readonly #export: Export;
  readonly #timeout: FixedDuration | ExpressionDuration | null;
  readonly #then: FlowDirective;

  constructor(props: TaskBaseProps) {
    this.#condition = props.condition;
    this.#input = props.input;
    this.#output = props.output;
    this.#export = props.export;
    this.#timeout = props.timeout;
    this.#then = props.then;
  }

  get condition(): Expression | null {
    return this.#condition;
  }

  get input(): Input {
    return this.#input;
  }

  get output(): Output {
    return this.#output;
  }

  get export(): Export {
    return this.#export;
  }

  get timeout(): FixedDuration | ExpressionDuration | null {
    return this.#timeout;
  }

  get then(): FlowDirective {
    return this.#then;
  }

  get expressions(): readonly Expression[] {
    const condition = this.#condition?.expressions ?? [];
    const input = this.#input.expressions;
    const output = this.#output.expressions;
    const exported = this.#export.expressions;
    const timeout = this.#timeout?.expressions ?? [];
    return condition.concat(input, output, exported, timeout);
  }
}
