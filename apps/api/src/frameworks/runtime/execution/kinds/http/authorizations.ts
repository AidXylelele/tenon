import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { AuthorizationKind } from '../../../enums.js';
import type { Authorization } from '../../../interfaces.js';
import type { Evaluator } from '../../evaluator.js';
import type { Scope } from '../../scope.js';

// An authentication policy as the endpoint client sends it: a header for basic and bearer, a
// client-credentials token for OAuth2 and OpenID Connect. A policy by name is the one declared
// in `use.authentications`; its values may be expressions of the task's input.
export class Authorizations {
  static readonly #TOKEN_PATH = '/oauth2/token';
  static readonly #TRAILING_SLASH = /\/$/;

  constructor(private readonly evaluator: Evaluator) {}

  async of(
    declared: JsonValue | undefined,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<Authorization | null> {
    const policy = this.#policyOf(declared, scope);

    if (policy === null) return null;

    const filled = (await this.evaluator.template(
      policy,
      input,
      args,
      scope.pointer,
    )) as JsonObject;
    const basic = filled.basic as JsonObject | undefined;

    if (basic !== undefined) {
      const credentials = `${Authorizations.#text(basic.username)}:${Authorizations.#text(basic.password)}`;
      const parameter = Buffer.from(credentials, 'utf8').toString('base64');
      return { kind: AuthorizationKind.Header, scheme: 'Basic', parameter };
    }

    const bearer = filled.bearer as JsonObject | undefined;

    if (bearer !== undefined) {
      const parameter = Authorizations.#text(bearer.token);
      return { kind: AuthorizationKind.Header, scheme: 'Bearer', parameter };
    }

    const oauth2 = filled.oauth2 as JsonObject | undefined;
    const scheme = oauth2 ?? (filled.oidc as JsonObject | undefined);

    if (scheme === undefined) return null;

    return Authorizations.#clientCredentials(scheme, oauth2 !== undefined);
  }

  #policyOf(declared: JsonValue | undefined, scope: Scope): JsonObject | null {
    if (
      declared === undefined ||
      declared === null ||
      typeof declared !== 'object'
    )
      return null;

    const policy = declared as JsonObject;
    const name = policy.use;

    if (typeof name !== 'string') return policy;

    const declaredPolicies = (scope.run.workflow.use?.authentications ??
      {}) as JsonObject;
    return (declaredPolicies[name] as JsonObject | undefined) ?? null;
  }

  static #clientCredentials(
    scheme: JsonObject,
    oauth2: boolean,
  ): Authorization {
    const authority = Authorizations.#text(scheme.authority).replace(
      Authorizations.#TRAILING_SLASH,
      '',
    );
    const client = (scheme.client ?? {}) as JsonObject;
    const endpoints = (scheme.endpoints ?? {}) as JsonObject;
    const tokenPath =
      Authorizations.#text(endpoints.token) || Authorizations.#TOKEN_PATH;
    const tokenEndpoint = oauth2 ? `${authority}${tokenPath}` : null;
    return {
      kind: AuthorizationKind.ClientCredentials,
      tokenEndpoint,
      issuer: oauth2 ? null : authority,
      clientId: Authorizations.#text(client.id),
      clientSecret: Authorizations.#text(client.secret),
      secretInHeader: client.authentication === 'client_secret_basic',
      scopes: Authorizations.#texts(scheme.scopes),
      audiences: Authorizations.#texts(scheme.audiences),
    };
  }

  static #texts(value: JsonValue | undefined): readonly string[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => Authorizations.#text(item));
  }

  static #text(value: JsonValue | undefined): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    return JSON.stringify(value);
  }
}
