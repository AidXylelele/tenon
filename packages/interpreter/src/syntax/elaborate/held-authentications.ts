import type {
  AuthenticationScheme,
  JsonValue,
  OAuth2Properties,
  ResolvedAuthentication,
} from "../../api/index.js";
import { rootPointer } from "../../runtime/index.js";
import {
  defaults,
  oauth2ClientAuthentications,
  oauth2Grants,
  oauth2RequestEncodings,
} from "../../standard/index.js";
import { itemsOf, objectFieldOf, optionalAt, requiredAt } from "./parts.js";
import { optionalMemberAt, requiredMemberAt, textOf } from "./scalars.js";
import type { Part } from "./types.js";

type OAuth2Endpoints = OAuth2Properties["endpoints"];

type OAuth2Token = OAuth2Properties["subject"];

export function heldAuthenticationOf(
  scheme: AuthenticationScheme,
  secret: JsonValue,
): ResolvedAuthentication {
  const held: Part = { value: secret, pointer: rootPointer, mode: "strict" };

  switch (scheme) {
    case "basic":
    case "digest": {
      const username = requiredAt(held, "username", textOf);
      const password = requiredAt(held, "password", textOf);
      return { kind: scheme, username, password };
    }
    case "bearer": {
      const token = requiredAt(held, "token", textOf);
      return { kind: scheme, token };
    }
    case "oauth2": {
      const endpoints = endpointsOf(held);
      const properties = oauth2Of(held, endpoints);
      return { kind: scheme, ...properties };
    }
    case "oidc": {
      const properties = oauth2Of(held, null);
      return { kind: scheme, ...properties };
    }
  }
}

function oauth2Of(held: Part, endpoints: OAuth2Endpoints): OAuth2Properties {
  const authority = requiredAt(held, "authority", textOf);
  const grant = requiredMemberAt(held, "grant", oauth2Grants);
  const client = clientOf(held);
  const encoding = encodingOf(held);
  const issuers = optionalAt(held, "issuers", textsOf) ?? [];
  const scopes = optionalAt(held, "scopes", textsOf) ?? [];
  const audiences = optionalAt(held, "audiences", textsOf) ?? [];
  const username = optionalAt(held, "username", textOf);
  const password = optionalAt(held, "password", textOf);
  const subject = optionalAt(held, "subject", tokenOf);
  const actor = optionalAt(held, "actor", tokenOf);

  return {
    authority,
    endpoints,
    grant,
    client,
    encoding,
    issuers,
    scopes,
    audiences,
    username,
    password,
    subject,
    actor,
  };
}

function clientOf(held: Part): OAuth2Properties["client"] {
  const client = objectFieldOf(held, "client");
  const id = optionalAt(client, "id", textOf);
  const secret = optionalAt(client, "secret", textOf);
  const assertion = optionalAt(client, "assertion", textOf);
  const authentication =
    optionalMemberAt(client, "authentication", oauth2ClientAuthentications) ??
    defaults.oauth2ClientAuthentication;

  return { id, secret, assertion, authentication };
}

function encodingOf(held: Part): OAuth2Properties["encoding"] {
  const request = objectFieldOf(held, "request");

  return (
    optionalMemberAt(request, "encoding", oauth2RequestEncodings) ??
    defaults.oauth2RequestEncoding
  );
}

function endpointsOf(held: Part): OAuth2Endpoints {
  const endpoints = objectFieldOf(held, "endpoints");
  const paths = defaults.oauth2Endpoints;
  const token = optionalAt(endpoints, "token", textOf) ?? paths.token;
  const revocation =
    optionalAt(endpoints, "revocation", textOf) ?? paths.revocation;
  const introspection =
    optionalAt(endpoints, "introspection", textOf) ?? paths.introspection;

  return { token, revocation, introspection };
}

function textsOf(part: Part): readonly string[] {
  return itemsOf(part).map(textOf);
}

function tokenOf(part: Part): OAuth2Token {
  const token = requiredAt(part, "token", textOf);
  const type = requiredAt(part, "type", textOf);

  return { token, type };
}
