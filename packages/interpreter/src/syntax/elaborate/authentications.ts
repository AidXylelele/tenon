import type { AuthenticationScheme } from "../../api/index.js";
import { authenticationSchemes } from "../../standard/index.js";
import type { AuthenticationPolicy } from "../ast/index.js";
import { oauth2Of, oidcOf } from "./oauth2.js";
import { fieldOf, requiredAt, requiredFieldOf } from "./parts.js";
import { keyOf } from "./scalars.js";
import type { Part } from "./types.js";
import { referenceOf, textTemplateOf } from "./values.js";

export function authenticationOf(part: Part): AuthenticationPolicy {
  const scheme = keyOf(part, authenticationSchemes);
  const properties = requiredFieldOf(part, scheme);
  const use = fieldOf(properties, "use");

  if (use === null) {
    return schemeOf(properties, scheme);
  }

  const secret = referenceOf(use);
  return { kind: "secret", pointer: properties.pointer, scheme, secret };
}

function schemeOf(
  properties: Part,
  scheme: AuthenticationScheme,
): AuthenticationPolicy {
  switch (scheme) {
    case "basic":
    case "digest": {
      const username = requiredAt(properties, "username", textTemplateOf);
      const password = requiredAt(properties, "password", textTemplateOf);
      return { kind: scheme, pointer: properties.pointer, username, password };
    }
    case "bearer": {
      const token = requiredAt(properties, "token", textTemplateOf);
      return { kind: scheme, pointer: properties.pointer, token };
    }
    case "oauth2":
      return oauth2Of(properties);
    case "oidc":
      return oidcOf(properties);
  }
}
