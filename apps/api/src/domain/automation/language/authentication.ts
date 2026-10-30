import type { AuthenticationScheme } from './enums.js';
import type { Expression } from './expression.js';
import type { AuthenticationProps } from './interfaces.js';
import type { Template } from './template.js';

export class Authentication {
  readonly #scheme: AuthenticationScheme;
  readonly #settings: Template;

  constructor(props: AuthenticationProps) {
    this.#scheme = props.scheme;
    this.#settings = props.settings;
  }

  get scheme(): AuthenticationScheme {
    return this.#scheme;
  }

  get settings(): Template {
    return this.#settings;
  }

  get expressions(): readonly Expression[] {
    return this.#settings.expressions;
  }
}
