import { AuthenticationPolicy } from './authentication-policy.js';
import type { ParsedEndpoint } from './interfaces.js';
import type { Scope } from './scope.js';

export class Endpoint {
  readonly #authentication: AuthenticationPolicy | null;

  constructor(authentication: AuthenticationPolicy | null) {
    this.#authentication = authentication;
  }

  static read(
    parsed: string | ParsedEndpoint | undefined,
    scope: Scope,
  ): Endpoint | null {
    if (parsed === undefined) return null;

    if (typeof parsed === 'string') return new Endpoint(null);

    const declared = parsed.authentication;
    const authenticationAt = scope.at('authentication');
    const authentication =
      declared === undefined
        ? null
        : AuthenticationPolicy.read(declared, authenticationAt);
    return new Endpoint(authentication);
  }

  get authentication(): AuthenticationPolicy | null {
    return this.#authentication;
  }
}
