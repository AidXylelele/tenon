import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { AuthorizationKind, EndpointOutcomeKind } from '../../../enums.js';
import type { Authorization, ExchangeOutcome } from '../../../interfaces.js';
import type { Evaluator } from '../../evaluator.js';
import { ErrorKind, TaskFault } from '../../faults.js';
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

    const evaluated = (await this.evaluator.template(
      policy,
      input,
      args,
      scope.pointer,
    )) as JsonObject;
    const filled = Authorizations.#withSecrets(evaluated, scope);
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

  // A secret-based policy (`basic: { use: name }`) takes its values from the secret; one that no
  // longer exists, or that the publisher does not own, is an authorization error (DSL 1.0.3,
  // "Secrets").
  static #withSecrets(policy: JsonObject, scope: Scope): JsonObject {
    const filled: Record<string, JsonValue> = {};

    for (const [scheme, settings] of Object.entries(policy)) {
      const named = (settings as JsonObject | undefined)?.use;

      if (typeof named !== 'string') {
        filled[scheme] = settings ?? null;
        continue;
      }

      const value = scope.run.secrets[named];

      if (value === undefined || value === null || typeof value !== 'object')
        throw TaskFault.of(
          ErrorKind.Authorization,
          scope.pointer,
          `The secret '${named}' is not available`,
        );

      filled[scheme] = value;
    }

    return filled;
  }

  // `$authorization` (DSL 1.0.3, "Authorization Descriptor") as the task's definition reads it:
  // a header scheme is resolved before the request, a client-credentials token only when sent.
  static argumentsWith(
    args: JsonObject,
    authorization: Authorization | null,
  ): JsonObject {
    if (authorization?.kind !== AuthorizationKind.Header) return args;

    const bound: Record<string, JsonValue> = {};
    Object.assign(bound, args);
    bound.authorization = {
      scheme: authorization.scheme,
      parameter: authorization.parameter,
    };
    return bound;
  }

  // `$authorization` as the call sent it, for its `output.as` and `export.as`.
  static sentBy(outcome: ExchangeOutcome): JsonObject | null {
    if (outcome.kind !== EndpointOutcomeKind.Responded) return null;

    const sent = outcome.authorization;

    if (sent === null) return null;

    return { scheme: sent.scheme, parameter: sent.parameter };
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
