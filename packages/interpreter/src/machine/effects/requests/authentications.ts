import type { Authentication, OAuth2Properties } from "../../../api/index.js";
import type {
  AuthenticationTemplate,
  BasicTemplate,
  BearerTemplate,
  DigestTemplate,
  EffectTemplate,
  OAuth2ClientTemplate,
  OAuth2Endpoints,
  OAuth2Template,
  OAuth2TemplateProperties,
  OAuth2TokenTemplate,
  OidcTemplate,
  SecretTemplate,
} from "../../../core/index.js";
import { expandedUriOf } from "../../../runtime/index.js";
import type { Building } from "./building.js";
import { optionalTextOf, textOf, textsOf } from "./shapes.js";

interface Credentials {
  readonly username: string;
  readonly password: string;
}

export function authenticationOf(
  authentication: AuthenticationTemplate,
  building: Building,
): Authentication | null {
  switch (authentication.kind) {
    case "none":
      return null;
    case "basic":
      return basicOf(authentication, building);
    case "digest":
      return digestOf(authentication, building);
    case "bearer":
      return bearerOf(authentication, building);
    case "oauth2":
      return oauth2PolicyOf(authentication, building);
    case "oidc":
      return oidcPolicyOf(authentication, building);
    case "secret":
      return secretOf(authentication);
  }
}

export function revealsAuthorization(
  effect: EffectTemplate,
  building: Building,
): boolean {
  return building.view.statics.readers.has(effect);
}

function basicOf(basic: BasicTemplate, building: Building): Authentication {
  const credentials = credentialsOf(basic, building);
  return { kind: "basic", ...credentials };
}

function digestOf(digest: DigestTemplate, building: Building): Authentication {
  const credentials = credentialsOf(digest, building);
  return { kind: "digest", ...credentials };
}

function credentialsOf(
  credentials: BasicTemplate | DigestTemplate,
  building: Building,
): Credentials {
  const username = textOf(credentials.username, building);
  const password = textOf(credentials.password, building);

  return { username, password };
}

function bearerOf(bearer: BearerTemplate, building: Building): Authentication {
  const token = textOf(bearer.token, building);
  return { kind: "bearer", token };
}

function oauth2PolicyOf(
  policy: OAuth2Template,
  building: Building,
): Authentication {
  const endpoints = endpointsOf(policy.endpoints, building);
  const properties = oauth2Of(policy, endpoints, building);

  return { kind: "oauth2", ...properties };
}

function oidcPolicyOf(
  policy: OidcTemplate,
  building: Building,
): Authentication {
  const properties = oauth2Of(policy, null, building);
  return { kind: "oidc", ...properties };
}

function secretOf(policy: SecretTemplate): Authentication {
  return { kind: "secret", scheme: policy.scheme, secret: policy.secret };
}

function oauth2Of(
  policy: OAuth2TemplateProperties,
  endpoints: OAuth2Properties["endpoints"],
  building: Building,
): OAuth2Properties {
  const authority = expandedUriOf(policy.authority.template, building.input);
  const client = oauth2ClientOf(policy.client, building);
  const issuers = textsOf(policy.issuers, building);
  const scopes = textsOf(policy.scopes, building);
  const audiences = textsOf(policy.audiences, building);
  const username = optionalTextOf(policy.username, building);
  const password = optionalTextOf(policy.password, building);
  const subject = tokenOf(policy.subject, building);
  const actor = tokenOf(policy.actor, building);

  return {
    authority,
    endpoints,
    grant: policy.grant,
    client,
    encoding: policy.encoding,
    issuers,
    scopes,
    audiences,
    username,
    password,
    subject,
    actor,
  };
}

function endpointsOf(
  endpoints: OAuth2Endpoints,
  building: Building,
): OAuth2Properties["endpoints"] {
  const input = building.input;
  const token = expandedUriOf(endpoints.token.template, input);
  const revocation = expandedUriOf(endpoints.revocation.template, input);
  const introspection = expandedUriOf(endpoints.introspection.template, input);

  return { token, revocation, introspection };
}

function oauth2ClientOf(
  client: OAuth2ClientTemplate,
  building: Building,
): OAuth2Properties["client"] {
  const id = optionalTextOf(client.id, building);
  const secret = optionalTextOf(client.secret, building);
  const assertion = optionalTextOf(client.assertion, building);

  return { id, secret, assertion, authentication: client.authentication };
}

function tokenOf(
  token: OAuth2TokenTemplate,
  building: Building,
): OAuth2Properties["subject"] {
  switch (token.kind) {
    case "none":
      return null;
    case "given": {
      const text = textOf(token.token, building);
      const type = textOf(token.type, building);
      return { token: text, type };
    }
  }
}
