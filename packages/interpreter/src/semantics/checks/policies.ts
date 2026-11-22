import type { AuthenticationScheme } from "../../api/index.js";
import type { OAuth2Grant } from "../../standard/index.js";
import type { AuthenticationPolicy } from "../../syntax/index.js";
import type { ReferenceTable } from "../symbols/index.js";
import type { Authentication } from "./types.js";

export function policyOf(
  authentication: Authentication | null,
  references: ReferenceTable,
): AuthenticationPolicy | null {
  if (authentication === null) {
    return null;
  }

  switch (authentication.kind) {
    case "reference":
      return references.authentications.get(authentication.pointer) ?? null;
    case "basic":
    case "bearer":
    case "digest":
    case "oauth2":
    case "oidc":
    case "secret":
      return authentication;
  }
}

export function schemeOf(policy: AuthenticationPolicy): AuthenticationScheme {
  switch (policy.kind) {
    case "secret":
      return policy.scheme;
    case "basic":
    case "bearer":
    case "digest":
    case "oauth2":
    case "oidc":
      return policy.kind;
  }
}

export function grantOf(policy: AuthenticationPolicy): OAuth2Grant | null {
  switch (policy.kind) {
    case "oauth2":
    case "oidc":
      return policy.grant;
    case "basic":
    case "bearer":
    case "digest":
    case "secret":
      return null;
  }
}
