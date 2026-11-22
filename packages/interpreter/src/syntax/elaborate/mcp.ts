import { defaults, mcpMethods, mcpTransports } from "../../standard/index.js";
import type {
  McpCall,
  McpClient,
  McpHttpTransport,
  McpStdioTransport,
  McpTransport,
} from "../ast/index.js";
import { durationOf } from "./durations.js";
import { endpointOf } from "./endpoints.js";
import { mapAt, optionalAt, requiredAt, requiredFieldOf } from "./parts.js";
import { keyOf, requiredMemberAt, textOf } from "./scalars.js";
import type { Part } from "./types.js";
import { textTemplateOf, transformOf, valueTemplateOf } from "./values.js";

export function mcpCallOf(call: Part): McpCall {
  const protocolVersion =
    optionalAt(call, "protocolVersion", textOf) ?? defaults.mcpProtocolVersion;
  const method = requiredMemberAt(call, "method", mcpMethods);
  const parameters = optionalAt(call, "parameters", transformOf);
  const timeout = optionalAt(call, "timeout", durationOf);
  const transport = requiredAt(call, "transport", transportOf);
  const client = optionalAt(call, "client", clientOf);

  return {
    kind: "mcp",
    pointer: call.pointer,
    protocolVersion,
    method,
    parameters,
    timeout,
    transport,
    client,
  };
}

function transportOf(part: Part): McpTransport {
  const options = mapAt(part, "options", textOf);
  const kind = keyOf(part, mcpTransports);
  const transport = requiredFieldOf(part, kind);

  switch (kind) {
    case "http":
      return httpTransportOf(transport, options);
    case "stdio":
      return stdioTransportOf(transport, options);
  }
}

function httpTransportOf(
  http: Part,
  options: ReadonlyMap<string, string>,
): McpHttpTransport {
  const endpoint = requiredAt(http, "endpoint", endpointOf);
  const headers = optionalAt(http, "headers", valueTemplateOf);

  return { kind: "http", pointer: http.pointer, endpoint, headers, options };
}

function stdioTransportOf(
  stdio: Part,
  options: ReadonlyMap<string, string>,
): McpStdioTransport {
  const command = requiredAt(stdio, "command", textTemplateOf);
  const parameters = optionalAt(stdio, "arguments", valueTemplateOf);
  const environment = optionalAt(stdio, "environment", valueTemplateOf);

  return {
    kind: "stdio",
    pointer: stdio.pointer,
    command,
    arguments: parameters,
    environment,
    options,
  };
}

function clientOf(part: Part): McpClient {
  const name = requiredAt(part, "name", textOf);
  const version = requiredAt(part, "version", textOf);

  return { pointer: part.pointer, name, version };
}
