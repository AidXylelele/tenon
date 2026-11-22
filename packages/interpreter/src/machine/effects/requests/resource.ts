import type { ResourceRequest } from "../../../api/index.js";
import type { ResourceTemplate } from "../../../core/index.js";
import { resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";

export function resourceRequestOf(
  resource: ResourceTemplate,
  building: Building,
): ResourceRequest {
  const read = resourceOf(resource, building);
  return { kind: "resource", resource: read };
}
