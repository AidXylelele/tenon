import type * as ast from "../../../syntax/index.js";
import {
  type GrpcService,
  type GrpcTemplate,
  grpcTemplate,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { optionalLiteralOf, templateOf } from "../templates.js";
import { authenticationTemplateOf } from "./authentications.js";
import { resourceTemplateOf } from "./endpoints.js";
import { noEntries } from "./neutrals.js";

export function grpcTemplateOf(
  call: ast.GrpcCall,
  context: Context,
): GrpcTemplate {
  const proto = resourceTemplateOf(call.proto, context);
  const service = serviceOf(call.service, context);
  const methodArguments = templateOf(call.arguments, noEntries, context);

  return grpcTemplate({
    proto,
    service,
    method: call.method,
    arguments: methodArguments,
  });
}

function serviceOf(service: ast.GrpcService, context: Context): GrpcService {
  const port = optionalLiteralOf(service.port);
  const authentication = authenticationTemplateOf(
    service.authentication,
    context,
  );

  return { name: service.name, host: service.host, port, authentication };
}
