import type { Endpoint, Resource } from "../../../api/index.js";
import type {
  EndpointTemplate,
  Expression,
  ResourceTemplate,
  UriTerm,
} from "../../../core/index.js";
import { Raised, expandedUriOf } from "../../../runtime/index.js";
import { shownValueOf } from "../../values/index.js";
import { authenticationOf } from "./authentications.js";
import type { Building } from "./building.js";
import { optionalTextOf, valueOf } from "./shapes.js";

export function resourceOf(
  resource: ResourceTemplate,
  building: Building,
): Resource {
  const name = optionalTextOf(resource.name, building);
  const endpoint = endpointOf(resource.endpoint, building);

  return { name, endpoint };
}

export function endpointOf(
  endpoint: EndpointTemplate,
  building: Building,
): Endpoint {
  const uri = uriOf(endpoint.uri, building);
  const authentication = authenticationOf(endpoint.authentication, building);

  return { uri, authentication };
}

function uriOf(uri: UriTerm, building: Building): string {
  switch (uri.kind) {
    case "uri":
      return expandedUriOf(uri.template, building.input);
    case "expression":
      return evaluatedUriOf(uri, building);
  }
}

function evaluatedUriOf(expression: Expression, building: Building): string {
  const value = valueOf(expression, building);
  const isText = typeof value === "string";

  if (!isText) {
    const shown = shownValueOf(expression, value);
    const detail = `The endpoint ${shown} is not a URI.`;
    throw Raised.standard("configuration", detail);
  }

  return value;
}
