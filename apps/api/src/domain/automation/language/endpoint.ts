import type { Authentication } from './authentication.js';
import type { Expression } from './expression.js';
import type { EndpointProps } from './interfaces.js';
import type { Template } from './template.js';

export class Endpoint {
  readonly #uri: Template;
  readonly #authentication: Authentication | null;

  constructor(props: EndpointProps) {
    this.#uri = props.uri;
    this.#authentication = props.authentication;
  }

  get uri(): Template {
    return this.#uri;
  }

  get authentication(): Authentication | null {
    return this.#authentication;
  }

  get expressions(): readonly Expression[] {
    const uri = this.#uri.expressions;
    const authentication = this.#authentication?.expressions ?? [];
    return uri.concat(authentication);
  }
}
