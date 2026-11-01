import type { Expression } from './expression.js';
import type { FlowDirective } from './flow-directive.js';
import type { SwitchCaseProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

export class SwitchCase {
  readonly #reference: JsonPointer;
  readonly #when: Expression | null;
  readonly #then: FlowDirective;

  constructor(props: SwitchCaseProps) {
    this.#reference = props.reference;
    this.#when = props.when;
    this.#then = props.then;
  }

  get reference(): JsonPointer {
    return this.#reference;
  }

  get when(): Expression | null {
    return this.#when;
  }

  get then(): FlowDirective {
    return this.#then;
  }

  isDefault(): boolean {
    return this.#when === null;
  }
}
