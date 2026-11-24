import type * as ast from "../../../syntax/index.js";
import {
  type AnonymousClient,
  type McpHttpTransport,
  type McpStdioTransport,
  type McpTemplate,
  type NamedClient,
  anonymousClient,
  mcpHttpTransport,
  mcpStdioTransport,
  mcpTemplate,
  namedClient,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf, writtenTemplateOf } from "../templates.js";
import { endpointTemplateOf } from "./endpoints.js";
import { noEntries, noItems } from "./neutrals.js";

export function mcpTemplateOf(
  call: ast.McpCall,
  context: Context,
): McpTemplate {
  const parameters = templateOf(call.parameters, null, context);
  const transport = transportOf(call.transport, context);
  const client = clientOf(call.client);

  return mcpTemplate({
    protocolVersion: call.protocolVersion,
    method: call.method,
    parameters,
    transport,
    client,
  });
}

function transportOf(
  transport: ast.McpTransport,
  context: Context,
): McpTemplate["transport"] {
  switch (transport.kind) {
    case "http":
      return httpTransportOf(transport, context);
    case "stdio":
      return stdioTransportOf(transport, context);
  }
}

function httpTransportOf(
  transport: ast.McpHttpTransport,
  context: Context,
): McpHttpTransport {
  const endpoint = endpointTemplateOf(transport.endpoint, context);
  const headers = templateOf(transport.headers, noEntries, context);
  const options = Object.fromEntries(transport.options);

  return mcpHttpTransport({ endpoint, headers, options });
}

function stdioTransportOf(
  transport: ast.McpStdioTransport,
  context: Context,
): McpStdioTransport {
  const command = writtenTemplateOf(transport.command, context);
  const commandArguments = templateOf(transport.arguments, noItems, context);
  const environment = templateOf(transport.environment, noEntries, context);
  const options = Object.fromEntries(transport.options);

  return mcpStdioTransport({
    command,
    arguments: commandArguments,
    environment,
    options,
  });
}

function clientOf(client: ast.McpClient | null): AnonymousClient | NamedClient {
  if (client === null) {
    return anonymousClient;
  }

  return namedClient({ name: client.name, version: client.version });
}
