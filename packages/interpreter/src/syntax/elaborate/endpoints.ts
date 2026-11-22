import type {
  AuthenticationPolicy,
  Endpoint,
  ExternalResource,
  Reference,
} from "../ast/index.js";
import { authenticationOf } from "./authentications.js";
import { fieldOf, optionalAt, requiredAt } from "./parts.js";
import { textOf } from "./scalars.js";
import type { Part } from "./types.js";
import { referenceOf, textTemplateOf } from "./values.js";

export function endpointOf(part: Part): Endpoint {
  if (typeof part.value === "string") {
    const uri = textTemplateOf(part);
    return { pointer: part.pointer, uri, authentication: null };
  }

  const uri = requiredAt(part, "uri", textTemplateOf);
  const authentication = optionalAt(
    part,
    "authentication",
    referenceablePolicyOf,
  );

  return { pointer: part.pointer, uri, authentication };
}

export function externalResourceOf(part: Part): ExternalResource {
  const name = optionalAt(part, "name", textOf);
  const endpoint = requiredAt(part, "endpoint", endpointOf);

  return { kind: "external", pointer: part.pointer, name, endpoint };
}

export function referenceablePolicyOf(
  part: Part,
): AuthenticationPolicy | Reference {
  const use = fieldOf(part, "use");

  if (use !== null) {
    return referenceOf(use);
  }

  return authenticationOf(part);
}
