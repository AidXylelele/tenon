import type { Expression } from './expression.js';
import type { FlowDirective } from './flow-directive.js';
import type { TaskProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { ReusableComponents } from './reusable-components.js';
import type { TaskBase } from './task-base.js';
import type { TaskList } from './task-list.js';

export abstract class Task {
  readonly #name: string;
  readonly #reference: JsonPointer;
  readonly #base: TaskBase;

  protected constructor(props: TaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#base = props.base;
  }

  get name(): string {
    return this.#name;
  }

  get reference(): JsonPointer {
    return this.#reference;
  }

  get base(): TaskBase {
    return this.#base;
  }

  get directives(): readonly FlowDirective[] {
    const then = this.#base.then;
    return [then];
  }

  get children(): readonly TaskList[] {
    return [];
  }

  get expressions(): readonly Expression[] {
    const shared = this.#base.expressions;
    const own = this.ownExpressions;
    return shared.concat(own);
  }

  confirmCalls(components: ReusableComponents): void {
    for (const list of this.children) list.confirmCalls(components);
  }

  protected abstract get ownExpressions(): readonly Expression[];
}
