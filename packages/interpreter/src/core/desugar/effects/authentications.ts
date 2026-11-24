import type * as ast from "../../../syntax/index.js";
import {
  type AuthenticationTemplate,
  type BasicTemplate,
  type BearerTemplate,
  type DigestTemplate,
  type OAuth2ClientTemplate,
  type OAuth2Endpoints,
  type OAuth2TemplateProperties,
  type OAuth2Template,
  type OAuth2TokenTemplate,
  type OidcTemplate,
  basicTemplate,
  bearerTemplate,
  digestTemplate,
  givenToken,
  noAuthentication,
  noToken,
  oAuth2Template,
  oidcTemplate,
  secretTemplate,
  uriTemplateTerm,
} from "../../forms/index.js";
import { componentOf } from "../components.js";
import type { Context } from "../context.js";
import { optionalPartOf, templateOf, writtenTemplateOf } from "../templates.js";
import { noItems } from "./neutrals.js";

export function authenticationTemplateOf(
  authentication: ast.AuthenticationPolicy | ast.Reference | null,
  context: Context,
): AuthenticationTemplate {
  if (authentication === null) {
    return noAuthentication;
  }

  const policies = context.model.symbols.references.authentications;
  const substitution = componentOf(authentication, policies, context);

  return policyTemplateOf(substitution.component, substitution.context);
}

function policyTemplateOf(
  policy: ast.AuthenticationPolicy,
  context: Context,
): AuthenticationTemplate {
  switch (policy.kind) {
    case "basic":
      return basicTemplateOf(policy, context);
    case "bearer":
      return bearerTemplateOf(policy, context);
    case "digest":
      return digestTemplateOf(policy, context);
    case "oauth2":
      return oAuth2TemplateOf(policy, context);
    case "oidc":
      return oidcTemplateOf(policy, context);
    case "secret":
      return secretTemplate({
        scheme: policy.scheme,
        secret: policy.secret.name,
      });
  }
}

function basicTemplateOf(
  policy: ast.BasicAuthentication,
  context: Context,
): BasicTemplate {
  const username = writtenTemplateOf(policy.username, context);
  const password = writtenTemplateOf(policy.password, context);

  return basicTemplate({ username, password });
}

function bearerTemplateOf(
  policy: ast.BearerAuthentication,
  context: Context,
): BearerTemplate {
  const token = writtenTemplateOf(policy.token, context);
  return bearerTemplate({ token });
}

function digestTemplateOf(
  policy: ast.DigestAuthentication,
  context: Context,
): DigestTemplate {
  const username = writtenTemplateOf(policy.username, context);
  const password = writtenTemplateOf(policy.password, context);

  return digestTemplate({ username, password });
}

function oAuth2TemplateOf(
  policy: ast.OAuth2Authentication,
  context: Context,
): OAuth2Template {
  const properties = oAuth2TemplatePropertiesOf(policy, context);
  const written = policy.endpoints;
  const token = uriTemplateTerm({ source: written.token });
  const revocation = uriTemplateTerm({ source: written.revocation });
  const introspection = uriTemplateTerm({ source: written.introspection });
  const endpoints: OAuth2Endpoints = { token, revocation, introspection };

  return oAuth2Template({
    endpoints,
    authority: properties.authority,
    grant: properties.grant,
    client: properties.client,
    encoding: properties.encoding,
    issuers: properties.issuers,
    scopes: properties.scopes,
    audiences: properties.audiences,
    username: properties.username,
    password: properties.password,
    subject: properties.subject,
    actor: properties.actor,
  });
}

function oidcTemplateOf(
  policy: ast.OidcAuthentication,
  context: Context,
): OidcTemplate {
  const properties = oAuth2TemplatePropertiesOf(policy, context);
  return oidcTemplate(properties);
}

function oAuth2TemplatePropertiesOf(
  policy: ast.OAuth2Properties,
  context: Context,
): OAuth2TemplateProperties {
  const client = clientTemplateOf(policy.client, context);
  const issuers = templateOf(policy.issuers, noItems, context);
  const scopes = templateOf(policy.scopes, noItems, context);
  const audiences = templateOf(policy.audiences, noItems, context);
  const username = optionalPartOf(policy.username, context);
  const password = optionalPartOf(policy.password, context);
  const subject = tokenTemplateOf(policy.subject, context);
  const actor = tokenTemplateOf(policy.actor, context);
  const authority = uriTemplateTerm({ source: policy.authority });

  return {
    authority,
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

function clientTemplateOf(
  client: ast.OAuth2Client,
  context: Context,
): OAuth2ClientTemplate {
  const id = optionalPartOf(client.id, context);
  const secret = optionalPartOf(client.secret, context);
  const assertion = optionalPartOf(client.assertion, context);

  return { id, secret, assertion, authentication: client.authentication };
}

function tokenTemplateOf(
  token: ast.OAuth2Token | null,
  context: Context,
): OAuth2TokenTemplate {
  if (token === null) {
    return noToken;
  }

  const written = writtenTemplateOf(token.token, context);
  const type = writtenTemplateOf(token.type, context);

  return givenToken({ token: written, type });
}
