import {
  a2aMethods,
  callProtocols,
  defaults,
  httpOutputModes,
  isMemberOf,
  type HttpOutputMode,
} from "../../standard/index.js";
import type {
  A2aAgentCard,
  A2aCall,
  A2aServer,
  Call,
  FunctionCall,
  GrpcCall,
  GrpcService,
  HttpCall,
  OpenApiCall,
} from "../ast/index.js";
import { asyncApiCallOf } from "./asyncapi.js";
import {
  endpointOf,
  externalResourceOf,
  referenceablePolicyOf,
} from "./endpoints.js";
import { mcpCallOf } from "./mcp.js";
import { fieldOf, optionalAt, requiredAt, requiredFieldOf } from "./parts.js";
import {
  booleanOf,
  numberOf,
  optionalMemberAt,
  requiredMemberAt,
  textOf,
} from "./scalars.js";
import type { Part } from "./types.js";
import {
  referenceOf,
  textTemplateOf,
  transformOf,
  valueTemplateOf,
} from "./values.js";

export function callOf(task: Part): Call {
  const target = requiredAt(task, "call", textOf);

  const isProtocol = isMemberOf(callProtocols, target);

  if (!isProtocol) {
    return functionCallOf(task);
  }

  const call = requiredFieldOf(task, "with");

  switch (target) {
    case "asyncapi":
      return asyncApiCallOf(call);
    case "grpc":
      return grpcCallOf(call);
    case "http":
      return httpCallOf(call);
    case "openapi":
      return openApiCallOf(call);
    case "a2a":
      return a2aCallOf(call);
    case "mcp":
      return mcpCallOf(call);
  }
}

function functionCallOf(task: Part): FunctionCall {
  const name = requiredFieldOf(task, "call");
  const reference = referenceOf(name);
  const parameters = optionalAt(task, "with", valueTemplateOf);

  return {
    kind: "function",
    pointer: name.pointer,
    function: reference,
    with: parameters,
  };
}

function httpCallOf(call: Part): HttpCall {
  const method = requiredAt(call, "method", textTemplateOf);
  const endpoint = requiredAt(call, "endpoint", endpointOf);
  const headers = optionalAt(call, "headers", valueTemplateOf);
  const body = optionalAt(call, "body", valueTemplateOf);
  const query = optionalAt(call, "query", valueTemplateOf);
  const output = outputModeOf(call);
  const redirect = redirectOf(call);

  return {
    kind: "http",
    pointer: call.pointer,
    method,
    endpoint,
    headers,
    body,
    query,
    output,
    redirect,
  };
}

function openApiCallOf(call: Part): OpenApiCall {
  const document = requiredAt(call, "document", externalResourceOf);
  const operationId = requiredAt(call, "operationId", textOf);
  const parameters = optionalAt(call, "parameters", valueTemplateOf);
  const authentication = optionalAt(
    call,
    "authentication",
    referenceablePolicyOf,
  );
  const output = outputModeOf(call);
  const redirect = redirectOf(call);

  return {
    kind: "openapi",
    pointer: call.pointer,
    document,
    operationId,
    parameters,
    authentication,
    output,
    redirect,
  };
}

function outputModeOf(call: Part): HttpOutputMode {
  return (
    optionalMemberAt(call, "output", httpOutputModes) ?? defaults.httpOutput
  );
}

function redirectOf(call: Part): boolean {
  return optionalAt(call, "redirect", booleanOf) ?? defaults.httpRedirect;
}

function grpcCallOf(call: Part): GrpcCall {
  const proto = requiredAt(call, "proto", externalResourceOf);
  const service = requiredAt(call, "service", serviceOf);
  const method = requiredAt(call, "method", textOf);
  const parameters = optionalAt(call, "arguments", valueTemplateOf);

  return {
    kind: "grpc",
    pointer: call.pointer,
    proto,
    service,
    method,
    arguments: parameters,
  };
}

function serviceOf(part: Part): GrpcService {
  const name = requiredAt(part, "name", textOf);
  const host = requiredAt(part, "host", textOf);
  const port = optionalAt(part, "port", numberOf);
  const authentication = optionalAt(
    part,
    "authentication",
    referenceablePolicyOf,
  );

  return { pointer: part.pointer, name, host, port, authentication };
}

function a2aCallOf(call: Part): A2aCall {
  const method = requiredMemberAt(call, "method", a2aMethods);
  const agent = agentOf(call);
  const parameters = optionalAt(call, "parameters", transformOf);

  return { kind: "a2a", pointer: call.pointer, method, agent, parameters };
}

function agentOf(call: Part): A2aAgentCard | A2aServer {
  const card = fieldOf(call, "agentCard");

  if (card !== null) {
    const resource = externalResourceOf(card);
    return { kind: "agentCard", pointer: card.pointer, resource };
  }

  const server = requiredFieldOf(call, "server");
  const endpoint = endpointOf(server);
  return { kind: "server", pointer: server.pointer, endpoint };
}
