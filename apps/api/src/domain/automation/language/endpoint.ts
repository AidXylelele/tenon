import type { Authentication } from './authentication.js';
import type { Expression } from './expression.js';
import type { EndpointProps, ServiceEndpoint } from './interfaces.js';
import type { RoundResults } from './round-results.js';
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

  get templates(): readonly Template[] {
    const settings = this.#authentication?.settings;

    if (settings === undefined) return [this.#uri];

    return [this.#uri, settings];
  }

  get expressions(): readonly Expression[] {
    const uri = this.#uri.expressions;
    const authentication = this.#authentication?.expressions ?? [];
    return uri.concat(authentication);
  }

  filled(prefix: string, results: RoundResults): ServiceEndpoint {
    const uri = this.#uri.fill(prefix, results);
    const authentication =
      this.#authentication?.filled(prefix, results) ?? null;
    return { uri, authentication };
  }
}
