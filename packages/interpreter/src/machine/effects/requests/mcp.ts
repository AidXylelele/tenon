import type { McpRequest } from "../../../api/index.js";
import type {
  McpHttpTransport,
  McpStdioTransport,
  McpTemplate,
} from "../../../core/index.js";
import { endpointOf } from "./endpoints.js";
import type { Building } from "./building.js";
import {
  argumentTextsOf,
  environmentOf,
  scalarTextsOf,
  textOf,
  valueOf,
} from "./shapes.js";

export function mcpRequestOf(mcp: McpTemplate, building: Building): McpRequest {
  const parameters = valueOf(mcp.parameters, building);
  const transport = transportOf(mcp.transport, building);
  const client = mcpClientOf(mcp.client);

  return {
    kind: "mcp",
    protocolVersion: mcp.protocolVersion,
    method: mcp.method,
    parameters,
    transport,
    options: mcp.transport.options,
    client,
  };
}

function transportOf(
  transport: McpHttpTransport | McpStdioTransport,
  building: Building,
): McpRequest["transport"] {
  switch (transport.kind) {
    case "http":
      return httpTransportOf(transport, building);
    case "stdio":
      return stdioTransportOf(transport, building);
  }
}

function httpTransportOf(
  transport: McpHttpTransport,
  building: Building,
): McpRequest["transport"] {
  const endpoint = endpointOf(transport.endpoint, building);
  const headers = scalarTextsOf(transport.headers, building);

  return { kind: "http", endpoint, headers };
}

function stdioTransportOf(
  transport: McpStdioTransport,
  building: Building,
): McpRequest["transport"] {
  const command = textOf(transport.command, building);
  const commandArguments = argumentTextsOf(transport.arguments, building);
  const environment = environmentOf(transport.environment, building);

  return {
    kind: "stdio",
    command,
    arguments: commandArguments,
    environment,
  };
}

function mcpClientOf(client: McpTemplate["client"]): McpRequest["client"] {
  switch (client.kind) {
    case "anonymous":
      return null;
    case "named":
      return { name: client.name, version: client.version };
  }
}
