import type * as ast from "../../../syntax/index.js";
import {
  type EndpointTemplate,
  type ResourceTemplate,
  resourceTemplate,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { optionalLiteralOf, uriTermOf } from "../templates.js";
import { authenticationTemplateOf } from "./authentications.js";

export function resourceTemplateOf(
  resource: ast.ExternalResource,
  context: Context,
): ResourceTemplate {
  const name = optionalLiteralOf(resource.name);
  const endpoint = endpointTemplateOf(resource.endpoint, context);

  return resourceTemplate({ name, endpoint });
}

export function endpointTemplateOf(
  endpoint: ast.Endpoint,
  context: Context,
): EndpointTemplate {
  const uri = uriTermOf(endpoint.uri, context);
  const authentication = authenticationTemplateOf(
    endpoint.authentication,
    context,
  );

  return { uri, authentication };
}
