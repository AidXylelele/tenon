import type {
  AuthenticationPolicy,
  Endpoint,
  ExternalResource,
  OAuth2Properties,
  OAuth2Token,
  Reference,
} from "../../syntax/index.js";
import { referenceOccurrencesOf, templateOccurrencesOf } from "./data.js";
import type { Context, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function endpointOccurrencesOf(
  endpoint: Endpoint,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(endpoint.uri, context),
    ...authenticationOccurrencesOf(endpoint.authentication, context),
  ];
}

export function resourceOccurrencesOf(
  resource: ExternalResource,
  context: Context,
): readonly Occurrence[] {
  return endpointOccurrencesOf(resource.endpoint, context);
}

export function authenticationOccurrencesOf(
  authentication: AuthenticationPolicy | Reference | null,
  context: Context,
): readonly Occurrence[] {
  if (authentication === null) {
    return none;
  }

  switch (authentication.kind) {
    case "reference":
      return referenceOccurrencesOf("authentications", authentication, context);
    case "basic":
    case "bearer":
    case "digest":
    case "oauth2":
    case "oidc":
    case "secret":
      return [
        { kind: "policy", policy: authentication, context },
        ...policyContentsOf(authentication, context),
      ];
  }
}

function policyContentsOf(
  policy: AuthenticationPolicy,
  context: Context,
): readonly Occurrence[] {
  switch (policy.kind) {
    case "basic":
    case "digest":
      return [
        ...templateOccurrencesOf(policy.username, context),
        ...templateOccurrencesOf(policy.password, context),
      ];
    case "bearer":
      return templateOccurrencesOf(policy.token, context);
    case "oauth2":
    case "oidc":
      return oauth2OccurrencesOf(policy, context);
    case "secret":
      return referenceOccurrencesOf("secrets", policy.secret, context);
  }
}

function oauth2OccurrencesOf(
  policy: OAuth2Properties,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(policy.client.id, context),
    ...templateOccurrencesOf(policy.client.secret, context),
    ...templateOccurrencesOf(policy.client.assertion, context),
    ...templateOccurrencesOf(policy.issuers, context),
    ...templateOccurrencesOf(policy.scopes, context),
    ...templateOccurrencesOf(policy.audiences, context),
    ...templateOccurrencesOf(policy.username, context),
    ...templateOccurrencesOf(policy.password, context),
    ...tokenOccurrencesOf(policy.subject, context),
    ...tokenOccurrencesOf(policy.actor, context),
  ];
}

function tokenOccurrencesOf(
  token: OAuth2Token | null,
  context: Context,
): readonly Occurrence[] {
  if (token === null) {
    return none;
  }

  return [
    ...templateOccurrencesOf(token.token, context),
    ...templateOccurrencesOf(token.type, context),
  ];
}
