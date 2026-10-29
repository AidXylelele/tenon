import { Expression } from '../expression.js';
import { FlowDirective } from '../flow-directive.js';
import type { ParsedSwitchCase, SwitchCaseProps } from '../interfaces.js';
import type { Scope } from '../scope.js';

export class SwitchCase {
  readonly #name: string;
  readonly #when: Expression | null;
  readonly #then: FlowDirective;

  constructor(props: SwitchCaseProps) {
    this.#name = props.name;
    this.#when = props.when;
    this.#then = props.then;
  }

  static read(
    name: string,
    parsed: ParsedSwitchCase,
    scope: Scope,
  ): SwitchCase {
    const whenAt = scope.at('when');
    const thenAt = scope.at('then');
    const when = Expression.read(parsed.when, whenAt);
    const then = FlowDirective.read(parsed.then, thenAt);
    return new SwitchCase({ name, when, then });
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
