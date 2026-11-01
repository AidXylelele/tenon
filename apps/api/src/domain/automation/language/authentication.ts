import type { AuthenticationScheme } from './enums.js';
import type { Expression } from './expression.js';
import type {
  AuthenticationProps,
  ServiceAuthentication,
} from './interfaces.js';
import type { RoundResults } from './round-results.js';
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

  filled(prefix: string, results: RoundResults): ServiceAuthentication {
    const settings = this.#settings.fill(prefix, results);
    return { scheme: this.#scheme, settings };
  }
}
