import {
  defaults,
  oauth2ClientAuthentications,
  oauth2Grants,
  oauth2RequestEncodings,
  type OAuth2RequestEncoding,
} from "../../standard/index.js";
import type {
  OAuth2Authentication,
  OAuth2Client,
  OAuth2Endpoints,
  OAuth2Properties,
  OAuth2Token,
  OidcAuthentication,
} from "../ast/index.js";
import { objectFieldOf, optionalAt, requiredAt } from "./parts.js";
import { optionalMemberAt, requiredMemberAt, textOf } from "./scalars.js";
import type { Part } from "./types.js";
import { textTemplateOf, valueTemplateOf } from "./values.js";

export function oauth2Of(properties: Part): OAuth2Authentication {
  const shared = propertiesOf(properties);
  const endpoints = endpointsOf(properties);

  return { kind: "oauth2", ...shared, endpoints };
}

export function oidcOf(properties: Part): OidcAuthentication {
  const shared = propertiesOf(properties);
  return { kind: "oidc", ...shared };
}

function propertiesOf(properties: Part): OAuth2Properties {
  const authority = requiredAt(properties, "authority", textOf);
  const grant = requiredMemberAt(properties, "grant", oauth2Grants);
  const client = clientOf(properties);
  const encoding = encodingOf(properties);
  const issuers = optionalAt(properties, "issuers", valueTemplateOf);
  const scopes = optionalAt(properties, "scopes", valueTemplateOf);
  const audiences = optionalAt(properties, "audiences", valueTemplateOf);
  const username = optionalAt(properties, "username", textTemplateOf);
  const password = optionalAt(properties, "password", textTemplateOf);
  const subject = optionalAt(properties, "subject", tokenOf);
  const actor = optionalAt(properties, "actor", tokenOf);

  return {
    pointer: properties.pointer,
    authority,
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

function clientOf(properties: Part): OAuth2Client {
  const client = objectFieldOf(properties, "client");
  const id = optionalAt(client, "id", textTemplateOf);
  const secret = optionalAt(client, "secret", textTemplateOf);
  const assertion = optionalAt(client, "assertion", textTemplateOf);
  const authentication =
    optionalMemberAt(client, "authentication", oauth2ClientAuthentications) ??
    defaults.oauth2ClientAuthentication;

  return { pointer: client.pointer, id, secret, assertion, authentication };
}

function encodingOf(properties: Part): OAuth2RequestEncoding {
  const request = objectFieldOf(properties, "request");
  return (
    optionalMemberAt(request, "encoding", oauth2RequestEncodings) ??
    defaults.oauth2RequestEncoding
  );
}

function endpointsOf(properties: Part): OAuth2Endpoints {
  const endpoints = objectFieldOf(properties, "endpoints");
  const paths = defaults.oauth2Endpoints;
  const token = optionalAt(endpoints, "token", textOf) ?? paths.token;
  const revocation =
    optionalAt(endpoints, "revocation", textOf) ?? paths.revocation;
  const introspection =
    optionalAt(endpoints, "introspection", textOf) ?? paths.introspection;

  return { pointer: endpoints.pointer, token, revocation, introspection };
}

function tokenOf(part: Part): OAuth2Token {
  const token = requiredAt(part, "token", textTemplateOf);
  const type = requiredAt(part, "type", textTemplateOf);

  return { pointer: part.pointer, token, type };
}
