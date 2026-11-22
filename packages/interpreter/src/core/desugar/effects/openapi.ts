import type * as ast from "../../../syntax/index.js";
import { type OpenApiTemplate, openApiTemplate } from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf } from "../templates.js";
import { authenticationTemplateOf } from "./authentications.js";
import { resourceTemplateOf } from "./endpoints.js";
import { noEntries } from "./neutrals.js";

export function openApiTemplateOf(
  call: ast.OpenApiCall,
  context: Context,
): OpenApiTemplate {
  const document = resourceTemplateOf(call.document, context);
  const parameters = templateOf(call.parameters, noEntries, context);
  const authentication = authenticationTemplateOf(call.authentication, context);

  return openApiTemplate({
    document,
    operationId: call.operationId,
    parameters,
    authentication,
    output: call.output,
  });
}
