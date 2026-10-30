import type { Expression } from '../expression.js';
import type { FlowDirective } from '../flow-directive.js';
import type { SwitchCaseProps } from '../interfaces.js';

export class SwitchCase {
  readonly #name: string;
  readonly #when: Expression | null;
  readonly #then: FlowDirective;

  constructor(props: SwitchCaseProps) {
    this.#name = props.name;
    this.#when = props.when;
    this.#then = props.then;
  }

  get name(): string {
    return this.#name;
  }

  get when(): Expression | null {
    return this.#when;
  }

  get then(): FlowDirective {
    return this.#then;
  }
}
