import type { OpenApiRequest } from "../../../api/index.js";
import type { OpenApiTemplate } from "../../../core/index.js";
import { authenticationOf, revealsAuthorization } from "./authentications.js";
import { resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";
import { entriesOf } from "./shapes.js";

export function openApiRequestOf(
  openapi: OpenApiTemplate,
  building: Building,
): OpenApiRequest {
  const document = resourceOf(openapi.document, building);
  const parameters = entriesOf(openapi.parameters, building);
  const authentication = authenticationOf(openapi.authentication, building);
  const revealAuthorization = revealsAuthorization(openapi, building);

  return {
    kind: "openapi",
    document,
    operationId: openapi.operationId,
    parameters,
    authentication,
    output: openapi.output,
    revealAuthorization,
  };
}
