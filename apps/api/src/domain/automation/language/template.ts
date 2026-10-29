import { Expression } from './expression.js';
import type { JsonValue, TemplateProps } from './interfaces.js';
import type { Scope } from './scope.js';

export class Template {
  readonly #pointer: string;
  readonly #value: JsonValue;

  constructor(props: TemplateProps) {
    this.#pointer = props.pointer;
    this.#value = props.value;
  }

  static read(value: JsonValue | undefined, scope: Scope): Template | null {
    if (value === undefined) return null;

    const template = new Template({ pointer: scope.pointer, value });
    template.#registerExpressions(value, scope);
    return template;
  }

  get pointer(): string {
    return this.#pointer;
  }

  get value(): JsonValue {
    return this.#value;
  }

  #registerExpressions(value: JsonValue, scope: Scope): void {
    if (typeof value === 'string') {
      const isExpression = Expression.isRuntime(value);

      if (isExpression) Expression.read(value, scope);

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const at = scope.at(index);
        this.#registerExpressions(item, at);
      });
      return;
    }

    if (value === null || typeof value !== 'object') return;

    for (const key of Object.keys(value)) {
      const item = value[key];

      if (item === undefined) continue;

      const at = scope.at(key);
      this.#registerExpressions(item, at);
    }
  }
}
