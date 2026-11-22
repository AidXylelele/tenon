import type * as ast from "../../../syntax/index.js";
import {
  type AsyncApiProtocolChoice,
  type AsyncApiPublishTemplate,
  type AsyncApiRequestTemplate,
  type AsyncApiServerTemplate,
  type AsyncApiTarget,
  asyncApiPublishTemplate,
  channelTarget,
  defaultProtocol,
  defaultServer,
  namedProtocol,
  namedServer,
  operationTarget,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf } from "../templates.js";
import { authenticationTemplateOf } from "./authentications.js";
import { resourceTemplateOf } from "./endpoints.js";
import { noEntries } from "./neutrals.js";

export function asyncApiPublishTemplateOf(
  call: ast.AsyncApiCall,
  message: ast.AsyncApiMessageExchange,
  context: Context,
): AsyncApiPublishTemplate {
  const request = asyncApiRequestTemplateOf(call, context);
  const payload = templateOf(message.payload, null, context);
  const headers = templateOf(message.headers, noEntries, context);

  return asyncApiPublishTemplate({
    document: request.document,
    target: request.target,
    server: request.server,
    protocol: request.protocol,
    authentication: request.authentication,
    payload,
    headers,
  });
}

export function asyncApiRequestTemplateOf(
  call: ast.AsyncApiCall,
  context: Context,
): AsyncApiRequestTemplate {
  const document = resourceTemplateOf(call.document, context);
  const target = targetOf(call.target);
  const server = serverOf(call.server, context);
  const protocol = protocolOf(call);
  const authentication = authenticationTemplateOf(call.authentication, context);

  return { document, target, server, protocol, authentication };
}

function targetOf(
  target: ast.AsyncApiChannelTarget | ast.AsyncApiOperationTarget,
): AsyncApiTarget {
  switch (target.kind) {
    case "channel":
      return channelTarget({ channel: target.channel });
    case "operation":
      return operationTarget({ operation: target.operation });
  }
}

function serverOf(
  server: ast.AsyncApiServer | null,
  context: Context,
): AsyncApiServerTemplate {
  if (server === null) {
    return defaultServer;
  }

  const variables = templateOf(server.variables, noEntries, context);
  return namedServer({ name: server.name, variables });
}

function protocolOf(call: ast.AsyncApiCall): AsyncApiProtocolChoice {
  if (call.server !== null) {
    return defaultProtocol;
  }

  if (call.protocol === null) {
    return defaultProtocol;
  }

  return namedProtocol({ protocol: call.protocol });
}
