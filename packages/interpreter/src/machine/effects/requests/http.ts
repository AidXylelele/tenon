import type { Endpoint, HttpRequest } from "../../../api/index.js";
import type { HttpTemplate } from "../../../core/index.js";
import { queriedUriOf } from "../../../runtime/index.js";
import { revealsAuthorization } from "./authentications.js";
import { endpointOf } from "./endpoints.js";
import type { Building } from "./building.js";
import { scalarEntriesOf, scalarTextsOf, textOf, valueOf } from "./shapes.js";

export function httpRequestOf(
  http: HttpTemplate,
  building: Building,
): HttpRequest {
  const written = textOf(http.method, building);
  const method = written.toUpperCase();
  const endpoint = endpointOf(http.endpoint, building);
  const query = scalarEntriesOf(http.query, building);
  const uri = queriedUriOf(endpoint.uri, query);
  const queried: Endpoint = { uri, authentication: endpoint.authentication };
  const headers = scalarTextsOf(http.headers, building);
  const body = valueOf(http.body, building);
  const revealAuthorization = revealsAuthorization(http, building);

  return {
    kind: "http",
    method,
    endpoint: queried,
    headers,
    body,
    output: http.output,
    revealAuthorization,
  };
}
