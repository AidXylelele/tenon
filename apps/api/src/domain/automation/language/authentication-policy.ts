import type {
  AuthenticationPolicyProps,
  ParsedAuthentication,
} from './interfaces.js';
import type { Scope } from './scope.js';
import { SupportedSubset } from './supported-subset.js';
import { Template } from './template.js';

export class AuthenticationPolicy {
  readonly #scheme: string;
  readonly #settings: Template | null;

  constructor(props: AuthenticationPolicyProps) {
    this.#scheme = props.scheme;
    this.#settings = props.settings;
  }

  static read(
    parsed: ParsedAuthentication,
    scope: Scope,
  ): AuthenticationPolicy | null {
    const name = parsed.use;
    const useAt = scope.at('use');

    if (name !== undefined) return scope.components.authentication(name, useAt);

    const accepted = SupportedSubset.acceptsAuthentication(parsed, scope);
    const scheme = SupportedSubset.schemeOf(parsed);

    if (!accepted || scheme === null) return null;

    const schemeAt = scope.at(scheme);
    const settings = Template.read(parsed[scheme], schemeAt);
    return new AuthenticationPolicy({ scheme, settings });
  }

  get scheme(): string {
    return this.#scheme;
  }

  get settings(): Template | null {
    return this.#settings;
  }
}
