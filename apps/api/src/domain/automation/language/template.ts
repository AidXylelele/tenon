import { Expression } from './expression.js';
import type { JsonValue, TemplateProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

export class Template {
  readonly #pointer: JsonPointer;
  readonly #value: JsonValue;

  constructor(props: TemplateProps) {
    this.#pointer = props.pointer;
    this.#value = props.value;
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  get value(): JsonValue {
    return this.#value;
  }

  get expressions(): readonly Expression[] {
    return this.#expressionsIn(this.#value, this.#pointer);
  }

  #expressionsIn(value: JsonValue, at: JsonPointer): readonly Expression[] {
    if (typeof value === 'string') {
      const runtime = Expression.isRuntime(value);

      if (!runtime) return [];

      const expression = Expression.of({ text: value, pointer: at });
      return [expression];
    }

    if (value === null || typeof value !== 'object') return [];

    const found: Expression[] = [];

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemAt = at.at(index);
        const inner = this.#expressionsIn(item, itemAt);

        for (const expression of inner) found.push(expression);
      });
      return found;
    }

    for (const key of Object.keys(value)) {
      const item = value[key];

      if (item === undefined) continue;

      const itemAt = at.at(key);
      const inner = this.#expressionsIn(item, itemAt);

      for (const expression of inner) found.push(expression);
    }

    return found;
  }
}
