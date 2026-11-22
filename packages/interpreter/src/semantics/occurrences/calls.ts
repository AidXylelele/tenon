import type {
  A2aAgentCard,
  A2aCall,
  A2aServer,
  AsyncApiCall,
  AsyncApiServer,
  CallTask,
  FunctionCall,
  GrpcCall,
  HttpCall,
  McpCall,
  McpTransport,
  OpenApiCall,
  TaskCommon,
} from "../../syntax/index.js";
import { durationOccurrencesOf, templateOccurrencesOf } from "./data.js";
import {
  authenticationOccurrencesOf,
  endpointOccurrencesOf,
  resourceOccurrencesOf,
} from "./endpoints.js";
import { exchangeOccurrencesOf } from "./events.js";
import type { Context, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function callOccurrencesOf(
  task: TaskCommon & CallTask,
  context: Context,
): readonly Occurrence[] {
  const call = task.call;

  switch (call.kind) {
    case "asyncapi":
      return asyncApiOccurrencesOf(call, context);
    case "grpc":
      return grpcOccurrencesOf(call, context);
    case "http":
      return httpOccurrencesOf(call, context);
    case "openapi":
      return openApiOccurrencesOf(call, context);
    case "a2a":
      return a2aOccurrencesOf(call, context);
    case "mcp":
      return mcpOccurrencesOf(call, context);
    case "function":
      return functionCallOccurrencesOf(call, task.pointer, context);
  }
}

function functionCallOccurrencesOf(
  call: FunctionCall,
  task: string,
  context: Context,
): readonly Occurrence[] {
  return [
    { kind: "call", task, call, context },
    ...templateOccurrencesOf(call.with, context),
  ];
}

function asyncApiOccurrencesOf(
  call: AsyncApiCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...resourceOccurrencesOf(call.document, context),
    ...serverOccurrencesOf(call.server, context),
    ...exchangeOccurrencesOf(call.exchange, context),
    ...authenticationOccurrencesOf(call.authentication, context),
  ];
}

function serverOccurrencesOf(
  server: AsyncApiServer | null,
  context: Context,
): readonly Occurrence[] {
  if (server === null) {
    return none;
  }

  return templateOccurrencesOf(server.variables, context);
}

function grpcOccurrencesOf(
  call: GrpcCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...resourceOccurrencesOf(call.proto, context),
    ...authenticationOccurrencesOf(call.service.authentication, context),
    ...templateOccurrencesOf(call.arguments, context),
  ];
}

function httpOccurrencesOf(
  call: HttpCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(call.method, context),
    ...endpointOccurrencesOf(call.endpoint, context),
    ...templateOccurrencesOf(call.headers, context),
    ...templateOccurrencesOf(call.body, context),
    ...templateOccurrencesOf(call.query, context),
  ];
}

function openApiOccurrencesOf(
  call: OpenApiCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...resourceOccurrencesOf(call.document, context),
    ...templateOccurrencesOf(call.parameters, context),
    ...authenticationOccurrencesOf(call.authentication, context),
  ];
}

function a2aOccurrencesOf(
  call: A2aCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...agentOccurrencesOf(call.agent, context),
    ...templateOccurrencesOf(call.parameters, context),
  ];
}

function agentOccurrencesOf(
  agent: A2aAgentCard | A2aServer,
  context: Context,
): readonly Occurrence[] {
  switch (agent.kind) {
    case "agentCard":
      return resourceOccurrencesOf(agent.resource, context);
    case "server":
      return endpointOccurrencesOf(agent.endpoint, context);
  }
}

function mcpOccurrencesOf(
  call: McpCall,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(call.parameters, context),
    ...durationOccurrencesOf(call.timeout, context),
    ...transportOccurrencesOf(call.transport, context),
  ];
}

function transportOccurrencesOf(
  transport: McpTransport,
  context: Context,
): readonly Occurrence[] {
  switch (transport.kind) {
    case "http":
      return [
        ...endpointOccurrencesOf(transport.endpoint, context),
        ...templateOccurrencesOf(transport.headers, context),
      ];
    case "stdio":
      return [
        ...templateOccurrencesOf(transport.command, context),
        ...templateOccurrencesOf(transport.arguments, context),
        ...templateOccurrencesOf(transport.environment, context),
      ];
  }
}
