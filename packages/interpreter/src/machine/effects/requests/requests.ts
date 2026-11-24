import type { EffectRequest } from "../../../api/index.js";
import type { EffectTemplate } from "../../../core/index.js";
import { a2aRequestOf } from "./a2a.js";
import { publishRequestOf } from "./asyncapi.js";
import { emitRequestOf } from "./emit.js";
import { grpcRequestOf } from "./grpc.js";
import { httpRequestOf } from "./http.js";
import { mcpRequestOf } from "./mcp.js";
import { openApiRequestOf } from "./openapi.js";
import { processRequestOf } from "./processes.js";
import { resourceRequestOf } from "./resource.js";
import type { Building } from "./building.js";
import { timerRequestOf } from "./timer.js";
import { workflowRequestOf } from "./workflow.js";

export function requestOf(
  effect: EffectTemplate,
  building: Building,
): EffectRequest {
  switch (effect.kind) {
    case "http":
      return httpRequestOf(effect, building);
    case "openapi":
      return openApiRequestOf(effect, building);
    case "grpc":
      return grpcRequestOf(effect, building);
    case "asyncapi":
      return publishRequestOf(effect, building);
    case "a2a":
      return a2aRequestOf(effect, building);
    case "mcp":
      return mcpRequestOf(effect, building);
    case "emit":
      return emitRequestOf(effect, building);
    case "timer":
      return timerRequestOf(effect, building);
    case "process":
      return processRequestOf(effect, building);
    case "workflow":
      return workflowRequestOf(effect, building);
    case "resource":
      return resourceRequestOf(effect, building);
  }
}
