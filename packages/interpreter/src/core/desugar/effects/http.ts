import type * as ast from "../../../syntax/index.js";
import { type HttpTemplate, httpTemplate } from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf, writtenTemplateOf } from "../templates.js";
import { endpointTemplateOf } from "./endpoints.js";
import { noEntries } from "./neutrals.js";

export function httpTemplateOf(
  call: ast.HttpCall,
  context: Context,
): HttpTemplate {
  const method = writtenTemplateOf(call.method, context);
  const endpoint = endpointTemplateOf(call.endpoint, context);
  const headers = templateOf(call.headers, noEntries, context);
  const body = templateOf(call.body, null, context);
  const query = templateOf(call.query, noEntries, context);

  return httpTemplate({
    method,
    endpoint,
    headers,
    body,
    query,
    output: call.output,
  });
}
