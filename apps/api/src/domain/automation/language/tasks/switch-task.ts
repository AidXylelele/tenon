import type { Expression } from '../expression.js';
import type { FlowDirective } from '../flow-directive.js';
import type { SwitchTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { SwitchCase } from './switch-case.js';

export class SwitchTask extends Task {
  readonly #cases: readonly SwitchCase[];

  constructor(props: SwitchTaskProps) {
    super(props);
    this.#cases = props.cases;
  }

  get cases(): readonly SwitchCase[] {
    return this.#cases;
  }

  override get directives(): readonly FlowDirective[] {
    const cases = this.#cases.map((switchCase) => switchCase.then);
    const own = super.directives;
    return cases.concat(own);
  }

  protected override get ownExpressions(): readonly Expression[] {
    const found: Expression[] = [];

    for (const switchCase of this.#cases)
      for (const expression of switchCase.when?.expressions ?? [])
        found.push(expression);

    return found;
  }
}
