import type { Scope } from './scope.js';

const KEYWORDS = new Set(['continue', 'exit', 'end']);

export class FlowDirective {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static read(text: string | undefined, scope: Scope): FlowDirective {
    const value = text ?? 'continue';
    const directive = new FlowDirective(value);
    const namesTask = directive.namesTask();
    const known = scope.knowsTask(value);

    if (namesTask && !known)
      scope.refuse(`"${value}" is not a task of this list`);

    return directive;
  }

  get value(): string {
    return this.#value;
  }

  namesTask(): boolean {
    const keyword = KEYWORDS.has(this.#value);
    return !keyword;
  }
}
