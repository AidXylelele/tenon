import type { A2aRequest, JsonObject, JsonValue } from "../../../api/index.js";
import type { A2aTemplate } from "../../../core/index.js";
import { derivedUuidOf, isJsonObject } from "../../../runtime/index.js";
import {
  a2aMessageMethods,
  defaults,
  isMemberOf,
} from "../../../standard/index.js";
import { endpointOf, resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";
import { valueOf } from "./shapes.js";

export function a2aRequestOf(a2a: A2aTemplate, building: Building): A2aRequest {
  const agent = agentOf(a2a.agent, building);
  const parameters = parametersOf(a2a, building);

  return { kind: "a2a", method: a2a.method, agent, parameters };
}

function agentOf(
  agent: A2aTemplate["agent"],
  building: Building,
): A2aRequest["agent"] {
  switch (agent.kind) {
    case "agentCard": {
      const card = resourceOf(agent.resource, building);
      return { kind: "card", card };
    }
    case "server": {
      const endpoint = endpointOf(agent.endpoint, building);
      return { kind: "server", endpoint };
    }
  }
}

function parametersOf(a2a: A2aTemplate, building: Building): JsonValue {
  const parameters = valueOf(a2a.parameters, building);
  const sendsMessage = isMemberOf(a2aMessageMethods, a2a.method);
  const isObject = isJsonObject(parameters);

  const isMessageCall = sendsMessage && isObject;

  if (!isMessageCall) {
    return parameters;
  }

  const written = parameters.message ?? null;
  const isMessage = isJsonObject(written);

  if (!isMessage) {
    return parameters;
  }

  const message = sentMessageOf(written, building);
  return { ...parameters, message };
}

function sentMessageOf(written: JsonObject, building: Building): JsonObject {
  const instance = building.view.run.instance;
  const messageId = derivedUuidOf(instance, building.id);

  return { messageId, role: defaults.a2aMessageRole, ...written };
}
