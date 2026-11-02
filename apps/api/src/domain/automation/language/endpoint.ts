import type { Authentication } from './authentication.js';
import type { EndpointProps, ServiceEndpoint } from './interfaces.js';
import type { RoundResults } from './round-results.js';
import type { Template } from './template.js';
import type { WorkKey } from './work-key.js';

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

  filled(key: WorkKey, results: RoundResults): ServiceEndpoint {
    const uri = this.#uri.fill(key, results);
    const authentication = this.#authentication?.filled(key, results) ?? null;
    return { uri, authentication };
  }
}
